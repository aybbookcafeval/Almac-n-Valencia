import { supabase } from '../lib/supabase';

// WARNING: This key is used on the client-side for this demo.
// Ensure your OpenRouter API key is restricted in the OpenRouter dashboard.
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash-lite";

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

export async function analizarFactura(file: File, materiasPrimas: any[] = []) {
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

    const inventarioStr = materiasPrimas.map(mp => `{ id: "${mp.id}", nombre: "${mp.nombre}", unidad: "${mp.unidad_medida}" }`).join(',\n');

    // 3. Call OpenRouter
    const prompt = `Eres el motor de auditoría y procesamiento de datos para la recepción de mercancía. 
    Procesa esta factura de proveedor detalladamente.
    
    INVENTARIO ACTUAL:
    [
    ${inventarioStr}
    ]

    Reglas de Extracción de Datos:
    - Estado: 'Recibido'.
    - Items: Extrae CADA ítem mencionado en la factura.
    - Para cada ítem:
      - 'nombre_factura': Nombre tal como aparece en la factura.
      - 'datos_json.nombre': Nombre normalizado/estándar del producto.
      - 'datos_json.cantidad': La CANTIDAD EXACTA encontrada en la factura (ej: "2kg", "500g", "10 unidades"). DEBE SER UN STRING NO NULO si existe en la factura.
      - Intenta asociar el 'producto_id' eligiendo el id del INVENTARIO ACTUAL que más se parezca al tipo de producto. Si estás razonablemente seguro, proporciona el 'producto_id' y asigna verificacion.match_status='OK'.
      - Si Producto no reconocido ni asimilable al inventario: producto_id = null, verificacion.match_status = 'MANUAL_SEARCH_REQUIRED'.
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

    // 2. Save reception to DB (We still leave estado strictly to what makes sense, maybe 'Recibido' or 'Aprobado')
    // A reception might just be 'Recibido' initially and later 'Aprobado' just to review details.
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

    // 3. Save items and create stock movements
    const bundle_id = 'rec_' + recepcionData.id;
    const { createMovimiento } = await import('./movimientos');

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

        let status = item.verificacion?.match_status || 'MANUAL_SEARCH_REQUIRED';
        if (status === 'MATCH_FOUND') status = 'OK';

        const { error: itemError } = await supabase.from('recepcion_items').insert({
            recepcion_id: recepcionData.id,
            producto_id: item.producto_id,
            nombre_factura: item.nombre_factura,
            datos_json: item.datos_json,
            peso_balanza: parseFloat(item.verificacion?.peso_balanza) || 0,
            match_status: status,
            imagen_url: itemImageUrl
        });
        if (itemError) {
            console.error('Failed to insert item:', itemError, item);
            throw itemError;
        }

        // Add to stock if valid product and amount
        if (recepcion.almacen_id && item.producto_id) {
            let cantidadStr = "";
            let datosObj = item.datos_json;
            if (datosObj) {
                if (typeof datosObj === 'string') {
                    try {
                        datosObj = JSON.parse(datosObj);
                    } catch (e) {
                        console.error('Error parsing datos_json:', e);
                    }
                }
                if (datosObj && typeof datosObj === 'object') {
                    cantidadStr = (datosObj as any).cantidad;
                }
            }
            
            let parsedCantidad = parseFloat(cantidadStr);
            
            if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
                const pb = item.verificacion?.peso_balanza;
                parsedCantidad = (typeof pb === 'number' && !isNaN(pb)) ? pb : parseFloat(pb);
            }

            if (!isNaN(parsedCantidad) && parsedCantidad > 0) {
                // Get unit
                let unidad_medida = 'kg';
                const { data: mpData } = await supabase
                    .from('materias_primas')
                    .select('unidad_medida')
                    .eq('id', item.producto_id)
                    .single();
                    
                if (mpData) unidad_medida = mpData.unidad_medida;

                try {
                    await createMovimiento({
                        materia_prima_id: item.producto_id,
                        almacen_id: recepcion.almacen_id,
                        tipo: 'entrada',
                        cantidad: parsedCantidad,
                        unidad_medida: unidad_medida,
                        bundle_id: bundle_id,
                        comentario: 'Recepción FC: ' + recepcionData.factura_nro
                    });
                } catch(e) {
                    console.error('Failed to create movement for item', item.nombre_factura, e);
                }
            }
        }
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

export async function aprobarRecepcion(id: string, estado: string, notas: string, almacen_id: string = '', updatedItems?: any[]) {
    console.log('Service: Aprobar recepcion', { id, estado, notas, almacen_id });
    
    if (updatedItems && updatedItems.length > 0) {
        for (const item of updatedItems) {
            if (item.id) {
                await supabase.from('recepcion_items').update({
                    producto_id: item.producto_id || null,
                    datos_json: item.datos_json
                }).eq('id', item.id);
            }
        }
    }

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
