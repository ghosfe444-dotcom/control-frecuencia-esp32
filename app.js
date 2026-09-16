// ==========================================
// CONFIGURACIÓN BLE
// ==========================================

const SERVICE_UUID =
    "12345678-1234-1234-1234-1234567890AB";

const DATOS_UUID =
    "87654321-4321-4321-4321-BA0987654321";

const RESUMEN_UUID =
    "11111111-2222-3333-4444-555555555555";


// ==========================================
// VARIABLES
// ==========================================

const dispositivos = new Map();

const btnConectar = document.getElementById("btnConectar");
const estadoGeneral = document.getElementById("estadoGeneral");
const tablaAlumnos = document.getElementById("tablaAlumnos");
const resumenes = document.getElementById("resumenes");


// ==========================================
// BOTÓN CONECTAR
// ==========================================

btnConectar.addEventListener("click", conectarESP32);


// ==========================================
// CONECTAR ESP32
// ==========================================

async function conectarESP32() {

    try {

        if (!navigator.bluetooth) {

            estadoGeneral.textContent =
                "Este navegador no permite Web Bluetooth.";

            return;
        }

        estadoGeneral.textContent =
            "Buscando ESP32...";

        const device = await navigator.bluetooth.requestDevice({

            filters: [
                {
                    services: [SERVICE_UUID]
                }
            ],

            optionalServices: [
                SERVICE_UUID
            ]
        });


        // Evitar conectar dos veces el mismo dispositivo

        if (dispositivos.has(device.id)) {

            estadoGeneral.textContent =
                "Ese ESP32 ya está conectado.";

            return;
        }


        estadoGeneral.textContent =
            "Conectando a " +
            (device.name || "ESP32") +
            "...";


        // Conectar mediante GATT

        const server = await device.gatt.connect();


        const service =
            await server.getPrimaryService(SERVICE_UUID);


        // Característica de datos en vivo

        const datos =
            await service.getCharacteristic(DATOS_UUID);


        // Característica de resumen

        const resumen =
            await service.getCharacteristic(RESUMEN_UUID);


        // Guardar dispositivo

        dispositivos.set(device.id, {

            device: device,

            server: server,

            datos: datos,

            resumen: resumen,

            alumno: device.name || "ESP32",

            bpm: 0,

            promedio: 0,

            zona: 0

        });


        // Crear fila

        crearFila(device.id);


        // Escuchar desconexión

        device.addEventListener(
            "gattserverdisconnected",
            () => dispositivoDesconectado(device.id)
        );


        // Activar notificaciones de datos

        await datos.startNotifications();

        datos.addEventListener(
            "characteristicvaluechanged",
            recibirDatos
        );


        // Activar notificaciones de resumen

        await resumen.startNotifications();

        resumen.addEventListener(
            "characteristicvaluechanged",
            recibirResumen
        );


        estadoGeneral.textContent =
            device.name +
            " conectado correctamente.";


    } catch (error) {

        console.error(error);

        estadoGeneral.textContent =
            "No se pudo conectar: " +
            error.message;
    }
}


// ==========================================
// CREAR FILA DEL ALUMNO
// ==========================================

function crearFila(id) {

    const datos = dispositivos.get(id);

    if (!datos) return;


    const fila = document.createElement("tr");

    fila.id = "fila-" + id;


    fila.innerHTML = `

        <td class="alumno">
            ${datos.alumno}
        </td>

        <td class="bpm">
            --
        </td>

        <td class="promedio">
            --
        </td>

        <td class="zona">
            --
        </td>

        <td class="estado estado-conectado">
            CONECTADO
        </td>

    `;


    tablaAlumnos.appendChild(fila);
}


// ==========================================
// RECIBIR DATOS EN VIVO
// ==========================================

function recibirDatos(event) {

    const decoder = new TextDecoder("utf-8");

    const texto =
        decoder
            .decode(event.target.value)
            .replace(/\0/g, "")
            .trim();


    console.log("Datos recibidos:", texto);


    /*
       Formato esperado:

       MATI | BPM=88.2 | P=87.6 | Z=3
    */


    const coincidencia = texto.match(
        /^(.+?)\s*\|\s*BPM=([\d.]+)\s*\|\s*P=([\d.]+)\s*\|\s*Z=(\d+)$/
    );


    if (!coincidencia) {

        console.log(
            "Formato de datos no reconocido:",
            texto
        );

        return;
    }


    const alumno = coincidencia[1].trim();

    const bpm = parseFloat(coincidencia[2]);

    const promedio = parseFloat(coincidencia[3]);

    const zona = parseInt(coincidencia[4]);


    // Buscar dispositivo por alumno

    for (const [id, datos] of dispositivos) {

        if (
            datos.alumno ===
            "ESP32_" + alumno
        ) {

            datos.bpm = bpm;

            datos.promedio = promedio;

            datos.zona = zona;

            actualizarFila(id);

            return;
        }
    }


    // Si no coincidió por nombre,
    // actualizar el dispositivo más reciente

    const dispositivosArray =
        Array.from(dispositivos.values());

    if (dispositivosArray.length > 0) {

        const datos =
            dispositivosArray[
                dispositivosArray.length - 1
            ];

        datos.bpm = bpm;

        datos.promedio = promedio;

        datos.zona = zona;

        const idEncontrado =
            Array.from(dispositivos.entries())
                .find(
                    ([, d]) => d === datos
                );

        if (idEncontrado) {

            actualizarFila(
                idEncontrado[0]
            );
        }
    }
}


// ==========================================
// ACTUALIZAR FILA
// ==========================================

function actualizarFila(id) {

    const datos = dispositivos.get(id);

    if (!datos) return;


    const fila =
        document.getElementById(
            "fila-" + id
        );


    if (!fila) return;


    fila.querySelector(".bpm")
        .textContent =
        datos.bpm.toFixed(1);


    fila.querySelector(".promedio")
        .textContent =
        datos.promedio.toFixed(1);


    fila.querySelector(".zona")
        .textContent =
        datos.zona;


    fila.querySelector(".estado")
        .textContent =
        "ACTIVO";


    fila.querySelector(".estado")
        .className =
        "estado estado-conectado";
}


// ==========================================
// RECIBIR RESUMEN
// ==========================================

function recibirResumen(event) {

    const decoder = new TextDecoder("utf-8");

    const texto =
        decoder
            .decode(event.target.value)
            .replace(/\0/g, "")
            .trim();


    console.log("Resumen recibido:", texto);


    /*
       Formato:

       MATI | Tiempo=125s | BPM=87.6 | P=87.6 |
       Z1=5.2% | Z2=18.4% | Z3=42.1% |
       Z4=28.7% | Z5=5.6%
    */


    const coincidencia = texto.match(
        /^(.+?)\s*\|\s*Tiempo=(\d+)s\s*\|\s*BPM=([\d.]+)\s*\|\s*P=([\d.]+)\s*\|\s*Z1=([\d.]+)%\s*\|\s*Z2=([\d.]+)%\s*\|\s*Z3=([\d.]+)%\s*\|\s*Z4=([\d.]+)%\s*\|\s*Z5=([\d.]+)%$/
    );


    if (!coincidencia) {

        console.log(
            "Formato de resumen no reconocido:",
            texto
        );

        return;
    }


    const alumno =
        coincidencia[1].trim();


    const tiempo =
        parseInt(coincidencia[2]);


    const bpm =
        parseFloat(coincidencia[3]);


    const promedio =
        parseFloat(coincidencia[4]);


    const zonas = [

        parseFloat(coincidencia[5]),

        parseFloat(coincidencia[6]),

        parseFloat(coincidencia[7]),

        parseFloat(coincidencia[8]),

        parseFloat(coincidencia[9])

    ];


    mostrarResumen(
        alumno,
        tiempo,
        bpm,
        promedio,
        zonas
    );
}


// ==========================================
// MOSTRAR RESUMEN
// ==========================================

function mostrarResumen(
    alumno,
    tiempo,
    bpm,
    promedio,
    zonas
) {

    const resumenExistente =
        document.getElementById(
            "resumen-" + alumno
        );


    let elemento;


    if (resumenExistente) {

        elemento = resumenExistente;

    } else {

        elemento =
            document.createElement("div");

        elemento.className =
            "resumen";

        elemento.id =
            "resumen-" + alumno;


        // Quitar mensaje inicial

        const mensaje =
            resumenes.querySelector(
                ".sin-datos"
            );

        if (mensaje) {
            mensaje.remove();
        }


        resumenes.appendChild(elemento);
    }


    elemento.innerHTML = `

        <h3>
            ${alumno}
        </h3>

        <p>
            <strong>Tiempo trabajado:</strong>
            ${tiempo} segundos
        </p>

        <p>
            <strong>BPM:</strong>
            ${bpm.toFixed(1)}
        </p>

        <p>
            <strong>Promedio:</strong>
            ${promedio.toFixed(1)}
        </p>

        <div class="zonas">

            <div class="zona">
                <strong>Z1</strong><br>
                ${zonas[0].toFixed(1)}%
            </div>

            <div class="zona">
                <strong>Z2</strong><br>
                ${zonas[1].toFixed(1)}%
            </div>

            <div class="zona">
                <strong>Z3</strong><br>
                ${zonas[2].toFixed(1)}%
            </div>

            <div class="zona">
                <strong>Z4</strong><br>
                ${zonas[3].toFixed(1)}%
            </div>

            <div class="zona">
                <strong>Z5</strong><br>
                ${zonas[4].toFixed(1)}%
            </div>

        </div>
    `;
}


// ==========================================
// DESCONEXIÓN
// ==========================================

function dispositivoDesconectado(id) {

    const datos =
        dispositivos.get(id);


    if (!datos) return;


    const fila =
        document.getElementById(
            "fila-" + id
        );


    if (fila) {

        const estado =
            fila.querySelector(".estado");


        estado.textContent =
            "DESCONECTADO";


        estado.className =
            "estado estado-desconectado";
    }


    estadoGeneral.textContent =
        datos.alumno +
        " se desconectó.";
}
