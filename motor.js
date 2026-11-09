// =========================================================================
// MOTOR AVANZADO: AUTÓMATA CELULAR (GRILLAS ESPACIALES)
// =========================================================================

// 1. Inicializar el mapa
const mapa = L.map('mapa').setView([-41.145, -71.308], 15);
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }).addTo(mapa);

// 2. Parámetros de la Grilla Forestal
const TAMANO_CELDA = 0.0004; // Aprox 40x40 metros
const FILAS = 60;
const COLUMNAS = 60;
let grilla = []; 
let celdasActivas = []; // Frente de llama (ardiendo)
let relojSimulacion = null;

// 3. Construir el Tablero Invisible
// Centramos la grilla donde está mirando el mapa
let centroLat = -41.145;
let centroLng = -71.308;
let inicioLat = centroLat + (FILAS/2 * TAMANO_CELDA);
let inicioLng = centroLng - (COLUMNAS/2 * TAMANO_CELDA);

for (let i = 0; i < FILAS; i++) {
    grilla[i] = [];
    for (let j = 0; j < COLUMNAS; j++) {
        grilla[i][j] = {
            fila: i,
            columna: j,
            lat: inicioLat - (i * TAMANO_CELDA),
            lng: inicioLng + (j * TAMANO_CELDA),
            estado: 0, // 0 = Virgen, 1 = Ardiendo (Frente), 2 = Quemado (Negro)
            poligono: null // Aquí guardaremos el cuadrado visual
        };
    }
}

console.log(`Grilla de ${FILAS * COLUMNAS} celdas tácticas generada.`);

// 4. La Ignición (Clic del usuario)
mapa.on('click', function(e) {
    // Detener simulaciones anteriores
    if(relojSimulacion) clearInterval(relojSimulacion);
    
    // Encontrar la celda exacta donde hizo clic el usuario
    let i = Math.round((inicioLat - e.latlng.lat) / TAMANO_CELDA);
    let j = Math.round((e.latlng.lng - inicioLng) / TAMANO_CELDA);
    
    if(i >= 0 && i < FILAS && j >= 0 && j < COLUMNAS) {
        encenderCelda(i, j);
        // Arrancar el motor: evaluar propagación cada 1 segundo (1000ms)
        relojSimulacion = setInterval(procesarAutómata, 1000);
    }
});

// Función auxiliar para dibujar fuego
function encenderCelda(i, j) {
    let celda = grilla[i][j];
    if(celda.estado === 0) {
        celda.estado = 1; // Pasarlo a "Ardiendo"
        celdasActivas.push(celda);
        
        // Dibujar el píxel de fuego en el mapa
        let limites = [[celda.lat, celda.lng], [celda.lat - TAMANO_CELDA, celda.lng + TAMANO_CELDA]];
        celda.poligono = L.rectangle(limites, {
            color: '#e74c3c', weight: 1, fillColor: '#f39c12', fillOpacity: 0.9
        }).addTo(mapa);
    }
}

// 5. El Cerebro del Fuego (Evaluación Celular)
function procesarAutómata() {
    let nuevosFocos = [];
    let vientoKmh = parseFloat(document.getElementById('input-viento').value);
    let humedad = parseFloat(document.getElementById('input-humedad').value);
    
    // Si la humedad es 100%, el fuego no avanza
    if (humedad >= 100) return; 

    // Leer cada celda que está ardiendo actualmente
    celdasActivas.forEach(celda => {
        // A. Apagar la celda actual (pasa a estado "Quemado" = 2)
        celda.estado = 2; 
        celda.poligono.setStyle({color: '#2c3e50', fillColor: '#000000', fillOpacity: 0.6});
        
        // B. Intentar contagiar a las 8 vecinas
        const direcciones = [
            {di: -1, dj: 0,  viento: 'Norte'}, 
            {di: 1,  dj: 0,  viento: 'Sur'},
            {di: 0,  dj: 1,  viento: 'Este'}, 
            {di: 0,  dj: -1, viento: 'Oeste'},
            {di: -1, dj: 1,  viento: 'Noreste'}, 
            {di: 1,  dj: 1,  viento: 'Sureste'}
            // Simplificado para la demostración
        ];
        
        direcciones.forEach(dir => {
            let ni = celda.fila + dir.di;
            let nj = celda.columna + dir.dj;
            
            // Si la celda vecina existe dentro del tablero y está virgen
            if(ni >= 0 && ni < FILAS && nj >= 0 && nj < COLUMNAS && grilla[ni][nj].estado === 0) {
                
                // Probabilidad base de contagio por temperatura (Humedad baja sube la probabilidad)
                let probabilidadContagio = (100 - humedad) / 100 * 0.4;
                
                // SIMULACIÓN TÁCTICA: El viento (en este ejemplo empuja al ESTE)
                // Si el viento supera 15km/h, la probabilidad de encender la celda ESTE aumenta drásticamente.
                if(vientoKmh > 15 && dir.viento === 'Este') {
                    probabilidadContagio += (vientoKmh / 100); 
                }
                if(vientoKmh > 15 && dir.viento === 'Oeste') {
                    probabilidadContagio -= 0.3; // La cola avanza muy lento
                }
                
                // Si el dado supera la probabilidad, se enciende
                if(Math.random() < probabilidadContagio) {
                    nuevosFocos.push({i: ni, j: nj});
                }
            }
        });
    });
    
    // Vaciamos el frente antiguo y encendemos las nuevas celdas
    celdasActivas = []; 
    nuevosFocos.forEach(foco => {
        encenderCelda(foco.i, foco.j);
    });

    // Conexiones visuales del panel HTML
    document.getElementById('valor-viento').innerText = document.getElementById('input-viento').value;
    document.getElementById('valor-humedad').innerText = document.getElementById('input-humedad').value;
}