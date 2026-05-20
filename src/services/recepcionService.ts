import { supabase } from '../lib/supabase';

// WARNING: This key is used on the client-side for this demo.
// Ensure your OpenRouter API key is restricted in the OpenRouter dashboard.
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.0-flash-lite-001";

async function callOpenRouter(messages: any[], model: string = VISION_MODEL): Promise<string> {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not defined");
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "CarnesTrace - Meat Traceability System",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "{}";
}

export async function analizarFactura(file: File) {
    // 1. Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transfer-evidence')
        .upload(`facturas/${Date.now()}_${file.name}`, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('transfer-evidence')
        .getPublicUrl(uploadData.path);

    // 2. Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // 3. Call OpenRouter
    const prompt = `Eres el motor de auditoría y procesamiento de datos para la recepción de mercancía. 
    Procesa esta factura de proveedor detalladamente.
    
    Reglas de Extracción de Datos:
    - Estado: 'Recibido'.
    - Items: Extrae CADA ítem mencionado en la factura.
    - Para cada ítem:
      - 'nombre_factura': Nombre tal como aparece en la factura.
      - 'datos_json.nombre': Nombre normalizado/estándar del producto.
      - 'datos_json.cantidad': La CANTIDAD EXACTA encontrada en la factura (ej: "2kg", "500g", "10 unidades"). DEBE SER UN STRING NO NULO si existe en la factura.
      - Producto no reconocido: producto_id = null, estado = 'MANUAL_SEARCH_REQUIRED'.
    - Pesos: Convertir a gramos (g) si es posible, mantener formato de cantidad robusto.
    
    Responde estrictamente con este formato JSON:
    {
        "recepcion": {
            "estado": "string",
            "proveedor": "string",
            "factura_nro": "string",
            "almacen_destino": "string",
            "items": [
                {
                    "producto_id": "string | null",
                    "nombre_factura": "string",
                    "datos_json": {
                        "nombre": "string",
                        "cantidad": "string | null"
                    },
                    "verificacion": {
                        "peso_balanza": "string",
                        "diferencia": "string",
                        "match_status": "string"
                    }
                }
            ]
        },
        "instruccion_db": "string"
    }`;

    const responseText = await callOpenRouter([
        {
            role: "user",
            content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Data}` } }
            ]
        }
    ]);

    const parsedResponse = JSON.parse(responseText || '{}');
    
    return { ...parsedResponse.recepcion, imagen_url: publicUrl };
}

export async function guardarRecepcion(recepcion: any) {
    // 1. Upload factura image if it's a File object (initially it might be a public URL string)
    let facturaUrl = recepcion.imagen_url;
    if (recepcion.factura_file instanceof File) {
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('transfer-evidence')
            .upload(`${Date.now()}_factura`, recepcion.factura_file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('transfer-evidence').getPublicUrl(uploadData.path);
        facturaUrl = publicUrl;
    }

    // 2. Save reception to DB
    const { data: recepcionData, error: dbError } = await supabase
        .from('recepciones')
        .insert({
            proveedor: recepcion.proveedor,
            factura_nro: recepcion.factura_nro,
            estado: 'Recibido',
            imagen_url: facturaUrl,
            notas: recepcion.notas || ''
        })
        .select()
        .single();
    
    if (dbError) throw dbError;

    // 3. Save items
    for (const item of recepcion.items) {
        let itemImageUrl = null;
        if (item.foto_item instanceof File) {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('transfer-evidence')
                .upload(`${Date.now()}_item_${item.nombre_factura}`, item.foto_item);
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('transfer-evidence').getPublicUrl(uploadData.path);
                itemImageUrl = publicUrl;
            }
        }

        await supabase.from('recepcion_items').insert({
            recepcion_id: recepcionData.id,
            producto_id: item.producto_id,
            nombre_factura: item.nombre_factura,
            datos_json: item.datos_json,
            peso_balanza: parseFloat(item.verificacion?.peso_balanza) || 0,
            match_status: item.verificacion?.match_status || 'MANUAL_SEARCH_REQUIRED',
            imagen_url: itemImageUrl
        });
    }
    
    return { id: recepcionData.id };
}

export async function listarRecepciones() {
    const { data, error } = await supabase
        .from('recepciones')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

export async function obtenerDetalleRecepcion(id: string) {
    const { data: recepcion, error: recepcionError } = await supabase
        .from('recepciones')
        .select('*, recepcion_items(*)')
        .eq('id', id)
        .single();
    
    if (recepcionError) throw recepcionError;
    return recepcion;
}

export async function aprobarRecepcion(id: string, estado: string, notas: string) {
    console.log('Service: Aprobar recepcion', { id, estado, notas });
    const { data, error } = await supabase
        .from('recepciones')
        .update({ estado, notas })
        .eq('id', id)
        .select('*');
    
    if (error) {
        console.error('Service: Error updating recepcion', error);
        throw error;
    }
    console.log('Service: Update successful', data);
    return data;
}
