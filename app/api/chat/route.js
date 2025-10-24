import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from 'next/server'; // Se usa NextResponse en lugar de Response

// Esta es la nueva forma de exportar el runtime de Edge
export const runtime = 'edge';

// 1. Inicializar el Limitador de Peticiones (Upstash)
const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(50, "1 d"), // 5 mensajes por 1 día por IP
  analytics: true,
});

// La función se debe llamar POST (en mayúsculas)
export async function POST(req) {
  
  // 2. Verificar el límite de peticiones
  // (Nueva forma de obtener la IP)
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    const errorMsg = "Has alcanzado el límite de 50 mensajes. Para pedir más, mándame un correo a [tu-email@dominio.com] con una oportunidad laboral o una idea de negocio con IA.";
    // Se usa NextResponse para enviar la respuesta de error
    return new NextResponse(JSON.stringify({ error: errorMsg }), { status: 429 });
  }

  // 3. Obtener la pregunta del usuario
  const { query } = await req.json();
  if (!query) {
    return new NextResponse(JSON.stringify({ error: 'No se recibió ninguna pregunta.' }), { status: 400 });
  }

  // 4. Proxy de Streaming a RunPod (Esta lógica es idéntica)
  try {
    const response = await fetch(process.env.RUNPOD_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` 
      },
      body: JSON.stringify({ query: query }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return new NextResponse(JSON.stringify({ error: `Error del servidor de IA: ${errorText}` }), { status: 500 });
    }

    // 5. Retransmitir la respuesta de RunPod
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    // Se retorna un Response estándar (esto está bien en Edge)
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error(error);
    return new NextResponse(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 });
  }
}