// =========================================================================
// MOTOR MATEMÁTICO DEL COMPORTAMIENTO DEL FUEGO (Basado en Rothermel)
// =========================================================================

// 1. DICCIONARIO DE MODELOS DE COMBUSTIBLE
// Valores base asumiendo terreno plano y sin viento.
const modelosCombustible = {
    // R0: Velocidad base (metros/min) | coefViento/Pendiente: Sensibilidad del material
    "pastizal": { R0: 2.5, coefViento: 0.015, coefPendiente: 0.005 },
    "matorral": { R0: 1.2, coefViento: 0.010, coefPendiente: 0.007 },
    "bosque":   { R0: 0.5, coefViento: 0.005, coefPendiente: 0.009 }
};

// 2. FUNCIÓN PRINCIPAL DE PROPAGACIÓN
// Calcula la velocidad en la "Cabeza" del incendio.
function calcularVelocidadFuego(tipoCombustible, vientoKmh, pendientePorc, humedadPorc) {
    
    // Validar que el combustible exista en nuestro diccionario
    const modelo = modelosCombustible[tipoCombustible];
    if (!modelo) {
        console.error("Error: Tipo de combustible no reconocido.");
        return 0;
    }

    // A. FACTOR DE HUMEDAD
    // Si la humedad baja de un estándar (ej. 15%), el fuego se acelera. Si sube, se frena.
    let factorHumedad = 15 / humedadPorc;

    // B. MULTIPLICADOR DE VIENTO (Phi W)
    // El viento afecta exponencialmente. Al cuadrado, porque empuja la llama hacia el combustible virgen.
    let phiViento = modelo.coefViento * Math.pow(vientoKmh, 2);

    // C. MULTIPLICADOR DE PENDIENTE (Phi S)
    // El fuego sube laderas más rápido porque precalienta el combustible de arriba.
    let phiPendiente = modelo.coefPendiente * Math.pow(pendientePorc, 2);

    // D. ECUACIÓN CENTRAL (Velocidad de Propagación hacia adelante)
    let velocidadFinal = modelo.R0 * (1 + phiViento + phiPendiente) * factorHumedad;

    // Redondeamos a dos decimales para que sea legible
    return parseFloat(velocidadFinal.toFixed(2));
}

// =========================================================================
// ZONA DE PRUEBAS (Se ejecuta automáticamente al abrir la página)
// =========================================================================

console.log("--- INICIANDO SIMULACIÓN DE ESCENARIOS ---");

// Escenario 1: Condiciones Ideales
let esc1 = calcularVelocidadFuego("pastizal", 0, 0, 15);
console.log("Escenario 1 (Pastizal, sin viento, plano, 15% HR): " + esc1 + " m/min");

// Escenario 2: Sube el viento en el mismo lugar
let esc2 = calcularVelocidadFuego("pastizal", 30, 0, 15);
console.log("Escenario 2 (Pastizal, Viento 30km/h, plano, 15% HR): " + esc2 + " m/min");

// Escenario 3: Viento + Ladera abrupta + Muy seco (Situación extrema)
let esc3 = calcularVelocidadFuego("pastizal", 30, 30, 5);
console.log("Escenario 3 (Pastizal, Viento 30km/h, pendiente 30%, 5% HR): " + esc3 + " m/min");

// Escenario 4: Mismo clima extremo, pero el fuego llega a un bosque denso
let esc4 = calcularVelocidadFuego("bosque", 30, 30, 5);
console.log("Escenario 4 (Bosque denso, Viento 30km/h, pendiente 30%, 5% HR): " + esc4 + " m/min");

// =========================================================================
// MOTOR CARTOGRÁFICO (Leaflet.js)
// =========================================================================

// 1. Inicializar el mapa
// Parámetros: ID del contenedor HTML, Coordenadas [Lat, Lng] y Nivel de Zoom inicial
const mapa = L.map('mapa').setView([-41.145, -71.308], 13);

// 2. Cargar la capa satelital/topográfica (OpenTopoMap)
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
}).addTo(mapa);

console.log("Módulo cartográfico cargado. Mapa topográfico activo.");

// =========================================================================
// MOTOR DE PROPAGACIÓN ESPACIAL (Huygens) Y SIMULACIÓN VISUAL
// =========================================================================

// Variables globales para la simulación
let puntoIgnicion = null; // Dónde hace clic el usuario
let poligonoFuego = null; // La forma geométrica dibujada en el mapa
let relojSimulacion = null; // El temporizador
let tiempoTranscurrido = 0; // Minutos simulados

// Parámetros climáticos fijos para esta prueba (más adelante los haremos variables)
let vientoKmhActual = 20; 
let direccionVientoGrados = 45; // 45° = Viento del Noreste (empuja hacia el Suroeste)
let pendientePorcActual = 0;
let humedadPorcActual = 15;
let combustibleActual = "pastizal";

// 1. Escuchar el Clic en el Mapa (La Ignición)
mapa.on('click', function(evento) {
    // Si ya hay un fuego activo, lo detenemos y reiniciamos
    if (relojSimulacion) {
        clearInterval(relojSimulacion);
        if (poligonoFuego) mapa.removeLayer(poligonoFuego);
    }
    
    // Guardamos la coordenada del clic original
    puntoIgnicion = evento.latlng;
    tiempoTranscurrido = 0;

    console.log(`🔥 Ignición detectada en: ${puntoIgnicion.lat}, ${puntoIgnicion.lng}`);
    
    // Iniciar el reloj: ejecuta avanzarFuego() cada 2000 milisegundos (2 segundos)
    relojSimulacion = setInterval(avanzarFuego, 2000);
});

// 2. Bucle de Crecimiento del Fuego
function avanzarFuego() {
    // Avanzamos 15 minutos en el mundo simulado en cada "tic" del reloj
    tiempoTranscurrido += 15; 
    
    // A. Calculamos la velocidad actual usando las Ecuaciones de Rothermel (Paso 2)
    let velocidadMtsMin = calcularVelocidadFuego(
        combustibleActual, vientoKmhActual, pendientePorcActual, humedadPorcActual
    );

    // B. Distancia total recorrida por la cabeza (Velocidad * Tiempo)
    let distanciaRecorridaMetros = velocidadMtsMin * tiempoTranscurrido;
    
    // C. Ajuste de geometría (Elipse de Huygens)
    // El viento aplasta los costados. Si no hay viento, ancho y largo son iguales (círculo).
    // Esta es una aproximación táctica visual.
    let factorElongacion = 1 + (vientoKmhActual / 10); 
    let radioLargo = distanciaRecorridaMetros; // La cabeza del fuego avanza la distancia total
    let radioAncho = distanciaRecorridaMetros / (factorElongacion * 0.5); // Los flancos crecen menos

    // D. Dibujar la nueva área en el mapa
    actualizarPoligonoFuego(puntoIgnicion, radioLargo, radioAncho, direccionVientoGrados);
    
    console.log(`⏱️ Minuto ${tiempoTranscurrido}: Fuego propagado ${distanciaRecorridaMetros.toFixed(0)} metros. Velocidad actual: ${velocidadMtsMin} m/min.`);
}

// 3. Renderizado Cartográfico (Las matemáticas espaciales)
function actualizarPoligonoFuego(centro, radioLargoMts, radioAnchoMts, anguloEmpuje) {
    // Borramos el polígono del "minuto" anterior
    if (poligonoFuego) {
        mapa.removeLayer(poligonoFuego);
    }

    // Convertimos el radio a grados (esto es necesario para dibujar en mapas GPS). 
    // Fórmula táctica aproximada: 1 grado terrestre son ~111,000 metros.
    const ajusteCartografico = 111000;
    
    // El viento empuja el fuego desde su origen. Calculamos hacia dónde se mueve el centro de la elipse.
    // Convertimos el ángulo a radianes para usar trigonometría.
    const anguloRadianes = (anguloEmpuje * Math.PI) / 180;
    
    // Desplazamos el centro de la elipse hacia adelante para simular que la cola crece menos que la cabeza.
    let desplazamientoCentroLat = (radioLargoMts * 0.4 / ajusteCartografico) * Math.cos(anguloRadianes);
    let desplazamientoCentroLng = (radioLargoMts * 0.4 / ajusteCartografico) * Math.sin(anguloRadianes);

    let nuevoCentroLat = centro.lat - desplazamientoCentroLat; // Restamos porque el norte es arriba
    let nuevoCentroLng = centro.lng - desplazamientoCentroLng;
    
    // Para simplificar esta versión sin usar librerías externas de geometría, 
    // dibujamos un círculo en Leaflet, pero pronto lo evolucionaremos a polígonos complejos.
    // (Por ahora, usamos el radio promedio para la demostración visual).
    let radioPromedio = (radioLargoMts + radioAnchoMts) / 2;

    poligonoFuego = L.circle([nuevoCentroLat, nuevoCentroLng], {
        color: '#e74c3c',       // Borde rojo fuego
        fillColor: '#f39c12',   // Interior naranja intenso
        fillOpacity: 0.5,
        radius: radioPromedio
    }).addTo(mapa);
}

// =========================================================================
// INTERFAZ DE USUARIO: LECTURA EN TIEMPO REAL
// =========================================================================

// 1. Actualizar los textos visuales cuando el instructor mueve los sliders
document.getElementById('input-viento').addEventListener('input', function(e) {
    document.getElementById('valor-viento').innerText = e.target.value;
});
document.getElementById('input-humedad').addEventListener('input', function(e) {
    document.getElementById('valor-humedad').innerText = e.target.value;
});
document.getElementById('input-pendiente').addEventListener('input', function(e) {
    document.getElementById('valor-pendiente').innerText = e.target.value;
});

// 2. Modificar el bucle de fuego para que lea el panel
// Sobrescribimos la función avanzarFuego que creamos en el Paso 4
function avanzarFuego() {
    tiempoTranscurrido += 15; 
    
    // AHORA LEEMOS LOS DATOS DIRECTAMENTE DEL PANEL EN PANTALLA
    vientoKmhActual = parseFloat(document.getElementById('input-viento').value);
    humedadPorcActual = parseFloat(document.getElementById('input-humedad').value);
    pendientePorcActual = parseFloat(document.getElementById('input-pendiente').value);
    combustibleActual = document.getElementById('input-combustible').value;

    // Calculamos la velocidad con los datos recién leídos
    let velocidadMtsMin = calcularVelocidadFuego(
        combustibleActual, vientoKmhActual, pendientePorcActual, humedadPorcActual
    );

    let distanciaRecorridaMetros = velocidadMtsMin * tiempoTranscurrido;
    
    let factorElongacion = 1 + (vientoKmhActual / 10); 
    let radioLargo = distanciaRecorridaMetros; 
    let radioAncho = distanciaRecorridaMetros / (factorElongacion * 0.5); 

    actualizarPoligonoFuego(puntoIgnicion, radioLargo, radioAncho, direccionVientoGrados);
}