export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const VISION_MODEL = "google/gemini-2.0-flash-lite-001";

export interface IdentifiedProduct {
  materia_prima_id: string;
  cantidad: number;
}

export async function identifyProductsFromImage(
  base64Image: string,
  inventory: Array<{ id: string; nombre: string; unidad_medida: string }>
): Promise<IdentifiedProduct[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('La clave VITE_OPENROUTER_API_KEY no está configurada.');
  }

  const prompt = `
Analiza la siguiente imagen e identifica los productos relacionados con este inventario.
Lista de inventario permitida (JSON):
${JSON.stringify(inventory.map(i => ({ id: i.id, nombre: i.nombre }))) }

Devuelve un objeto JSON con la clave "productos", que sea un array de objetos con las propiedades "materia_prima_id" y "cantidad".
Estima la "cantidad" visualmente o asigna 1 de no ser claro.
Usa SOLAMENTE los IDs proporcionados en el inventario. Asegúrate de devolver formato JSON válido.
Ejemplo:
{
  "productos": [
    { "materia_prima_id": "uuid-here", "cantidad": 2 }
  ]
}
  `;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href, // Recommended by OpenRouter
      'X-Title': 'Valencia Almacen', // Recommended by OpenRouter
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error de OpenRouter AI: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Respuesta inválida de la IA');
  }

  try {
    let jsonStr = content;
    // Si la IA incluye backticks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    const parsed = JSON.parse(jsonStr);
    return parsed.productos || [];
  } catch (err) {
    console.error("Failed to parse AI response:", content);
    throw new Error('La respuesta de la IA no es un JSON válido.');
  }
}
