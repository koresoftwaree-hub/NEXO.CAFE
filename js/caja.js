import { db } from './firebase-config.js';
// IMPORTANTE: Ya no importamos updateDoc ni increment, solo lectura
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class NexoCajaApp {
    constructor() {
        this.db = db;
        this.html5QrCode = null;
        this.clienteActual = null;
        // El PIN ya no está aquí por seguridad

        this.ui = {
            login: document.getElementById('pantallaLogin'),
            busqueda: document.getElementById('pantallaBusqueda'),
            acciones: document.getElementById('pantallaAcciones'),
            contenedorAcciones: document.getElementById('contenedorAcciones'),
            contenedorPremios: document.getElementById('contenedorPremios'),
            loader: document.getElementById('mensajeLoader'),
            pinInput: document.getElementById('inputPin'),
            errorCamara: document.getElementById('errorCamara'),
            modalAlerta: document.getElementById('modalAlertaCustom'),
            textoAlerta: document.getElementById('textoAlertaCustom'),
            modalConfirm: document.getElementById('modalConfirmCustom'),
            textoConfirm: document.getElementById('textoConfirmCustom')
        };

        this.audioBeep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'); 

        this.iniciarEventos();
        this.verificarSeguridad();
    }

    mostrarAlerta(mensaje) {
        this.ui.textoAlerta.innerText = mensaje;
        this.ui.modalAlerta.style.display = 'flex';
    }

    mostrarConfirmacion(mensaje, callbackAceptar) {
        this.ui.textoConfirm.innerText = mensaje;
        this.ui.modalConfirm.style.display = 'flex';
        
        const btnAceptar = document.getElementById('btnAceptarConfirm');
        const nuevoBtnAceptar = btnAceptar.cloneNode(true);
        btnAceptar.parentNode.replaceChild(nuevoBtnAceptar, btnAceptar);
        
        nuevoBtnAceptar.onclick = () => {
            this.ui.modalConfirm.style.display = 'none';
            callbackAceptar();
        };
        
        document.getElementById('btnCancelarConfirm').onclick = () => {
            this.ui.modalConfirm.style.display = 'none';
        };
    }

    iniciarEventos() {
        document.getElementById('btnCerrarAlerta').addEventListener('click', () => {
            this.ui.modalAlerta.style.display = 'none';
        });

        document.getElementById('btnDesbloquear').addEventListener('click', () => this.verificarPin());
        this.ui.pinInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') this.verificarPin(); });
        
        document.getElementById('btnBuscarManual').addEventListener('click', () => {
            let tel = document.getElementById('inputTelBusqueda').value.replace(/\D/g,'');
            if(tel.length < 8) return this.mostrarAlerta("Número inválido. Ingrese al menos 8 dígitos.");
            this.pausarCamara();
            this.buscarClienteEnFirebase(tel);
        });

        document.getElementById('btnSumar').addEventListener('click', () => this.modificarSellos(1));
        document.getElementById('btnRestar').addEventListener('click', () => this.modificarSellos(-1));
        document.getElementById('btnVolver').addEventListener('click', () => this.volverABuscar());
    }

    reproducirBeep() { try { this.audioBeep.play().catch(e=>{}); } catch(e){} }
    vibrar(patron) { if ("vibrate" in navigator) { navigator.vibrate(patron); } }

    verificarSeguridad() {
        if (localStorage.getItem('baristaAutorizado') === 'true') {
            this.ui.login.style.display = 'none';
            this.iniciarCamara();
        }
    }

    verificarPin() {
        const pinIngresado = this.ui.pinInput.value;
        if(pinIngresado.trim() === '') return;
        
        // Guardamos el PIN en memoria temporal para enviarlo al servidor en cada operación
        localStorage.setItem('pinTemporalCaja', pinIngresado);
        localStorage.setItem('baristaAutorizado', 'true');
        
        this.ui.login.style.display = 'none';
        this.iniciarCamara();
    }

    iniciarCamara() {
        this.ui.errorCamara.style.display = 'none';
        if (!this.html5QrCode) { this.html5QrCode = new Html5Qrcode("reader"); }
        
        this.html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 180, height: 180 } },
            (decodedText) => this.onScanSuccess(decodedText),
            () => { }
        ).catch((err) => {
            console.error("Fallo cámara: ", err);
            this.ui.errorCamara.style.display = 'block'; 
        });
    }

    pausarCamara() {
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.stop().catch(err => console.log(err));
        }
    }

    onScanSuccess(decodedText) {
        this.reproducirBeep();
        this.vibrar(100);
        this.pausarCamara();
        this.buscarClienteEnFirebase(decodedText);
    }

    async buscarClienteEnFirebase(telefono) {
        this.ui.busqueda.style.display = 'none';
        this.ui.loader.style.display = 'block';

        try {
            // Aún leemos de Firebase directamente porque las reglas lo permiten
            const docRef = doc(this.db, "clientes", telefono);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const datos = docSnap.data();
                
                this.clienteActual = {
                    id: telefono,
                    puntos: datos.puntos || 0,
                    desc3Usado: datos.desc3Usado || false,
                    desc5Usado: datos.desc5Usado || false
                };
                
                document.getElementById('uiNombre').innerText = datos.nombre;
                document.getElementById('uiTel').innerText = telefono;
                document.getElementById('uiAvatar').innerText = datos.nombre.charAt(0).toUpperCase();

                this.actualizarVistaPuntos();
                this.renderizarBotonesEspeciales();

                this.ui.loader.style.display = 'none';
                this.ui.acciones.style.display = 'flex'; 
            } else {
                this.mostrarAlerta("Cliente no encontrado en la base de datos.");
                this.volverABuscar();
            }
        } catch (error) {
            console.error(error);
            this.mostrarAlerta("Error de conexión con el servidor.");
            this.volverABuscar();
        }
    }

    actualizarVistaPuntos() {
        document.getElementById('uiSellos').innerText = this.clienteActual.puntos;
        const contenedor = document.querySelector('.estado-sellos-container');
        const texto = document.querySelector('.estado-sellos-texto');
        
        if (this.clienteActual.puntos >= 8) {
            contenedor.classList.add('completado');
            texto.innerText = "¡TARJETA COMPLETA!";
        } else {
            contenedor.classList.remove('completado');
            texto.innerText = "TAZAS ACUMULADAS:";
        }
    }

    renderizarBotonesEspeciales() {
        this.ui.contenedorPremios.innerHTML = '';
        this.ui.contenedorAcciones.classList.remove('glow-premio');
        
        const ptos = this.clienteActual.puntos;
        let tienePremioPendiente = false;

        document.getElementById('btnSumar').style.display = ptos < 8 ? 'block' : 'none';

        if (ptos >= 3 && !this.clienteActual.desc3Usado) {
            const svgBakery = `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="m20.725 17.825 -2.775 -1 2.075 -5.125 2.125 4.375c0.33335 0.66665 0.325 1.17915 -0.025 1.5375 -0.35 0.35835 -0.81665 0.42915 -1.4 0.2125Zm-6.15 -0.45 1.55 -9.575c0.0667 -0.38335 0.2125 -0.65 0.4375 -0.8 0.225 -0.15 0.5292 -0.15 0.9125 0l1.65 0.65c0.3167 0.13335 0.5375 0.32085 0.6625 0.5625 0.125 0.24165 0.1125 0.54585 -0.0375 0.9125l-3.375 8.25h-1.8Zm-6.7 0 -3.37499 -8.25c-0.13333 -0.33335 -0.14583 -0.62915 -0.0375 -0.8875 0.108335 -0.25835 0.32917 -0.45415 0.66249 -0.5875l1.65 -0.65c0.33335 -0.13335 0.62085 -0.14165 0.8625 -0.025 0.2417 0.11665 0.4042 0.39165 0.4875 0.825l1.55 9.575h-1.8Zm-4.34999 0.45c-0.58333 0.21665 -1.05 0.14585 -1.4 -0.2125 -0.35 -0.35835 -0.35833 -0.87085 -0.025 -1.5375l2.125 -4.375L6.3 16.825l-2.77499 1Zm7.39999 -0.45 -1.65 -10.7c-0.0833 -0.55 0.025 -0.96665 0.325 -1.25s0.725 -0.425 1.275 -0.425h2.5c0.55 0 0.975 0.14165 1.275 0.425 0.3 0.28335 0.40835 0.7 0.325 1.25l-1.65 10.7h-2.4Z" fill="currentColor"></path></svg>`;
            this.crearBotonDescuento("Entregar 5% OFF (Panificados)", 'desc3Usado', svgBakery);
            tienePremioPendiente = true;
        }

        if (ptos >= 5 && !this.clienteActual.desc5Usado) {
            const svgBolt = `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="m11.4251 14.3501 -6.80002 -0.8c-0.31667 -0.03335 -0.525 -0.20415 -0.625 -0.5125 -0.1 -0.30835 -0.033335 -0.57085 0.2 -0.7875l11.00002 -10.1c0.06665 -0.05 0.1375 -0.09167 0.2125 -0.125 0.075 -0.033335 0.1875 -0.05 0.3375 -0.05 0.25 0 0.44165 0.104165 0.575 0.3125 0.1333 0.20833 0.1333 0.42083 0 0.6375l-3.75 6.725 6.8 0.8c0.31665 0.03335 0.525 0.20415 0.625 0.5125 0.1 0.30835 0.0333 0.57085 -0.2 0.7875l-11 10.1c-0.0667 0.05 -0.1375 0.09165 -0.2125 0.125 -0.075 0.03335 -0.1875 0.05 -0.3375 0.05 -0.25 0 -0.4417 -0.10415 -0.575 -0.3125 -0.13335 -0.20835 -0.13335 -0.42085 0 -0.6375l3.75 -6.725Zm-0.1 3 6.3 -5.575 -7.425 -0.9 2.475 -4.225 -6.325 5.6 7.425 0.875 -2.45 4.225Z" fill="currentColor"></path></svg>`;
            this.crearBotonDescuento("Entregar Barrita GRATIS", 'desc5Usado', svgBolt);
            tienePremioPendiente = true;
        }

        if (ptos >= 8) {
            const btnCanjeTotal = document.createElement('button');
            btnCanjeTotal.className = 'btn btn-canje';
            btnCanjeTotal.style.display = 'block';
            
            btnCanjeTotal.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <svg viewBox="0 0 100 100" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20,35 H80 V75 Q80,90 65,90 H35 Q20,90 20,75 Z" fill="var(--white)"/>
                        <path d="M80,45 Q95,45 95,60 T80,75" fill="none" stroke="var(--white)" stroke-width="10" stroke-linecap="round"/>
                        <path d="M38,30 V12 M50,32 V8 M62,30 V16" stroke="var(--white)" stroke-width="6" stroke-linecap="round" fill="none"/>
                    </svg>
                    Entregar Bebida Gratis
                </div>
            `;
            btnCanjeTotal.onclick = () => this.canjearPremioFinal();
            this.ui.contenedorPremios.appendChild(btnCanjeTotal);
            tienePremioPendiente = true;
        }

        if(tienePremioPendiente) {
            this.ui.contenedorAcciones.classList.add('glow-premio');
        }
    }

    crearBotonDescuento(texto, campoDb, svgIcon) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-premio-intermedio';
        btn.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                ${svgIcon}
                ${texto}
            </div>
        `;
        btn.onclick = () => this.registrarDescuento(campoDb, texto);
        this.ui.contenedorPremios.appendChild(btn);
    }

    async registrarDescuento(campoDb, nombreDesc) {
        this.mostrarConfirmacion(`¿Confirmas aplicar el beneficio: ${nombreDesc}?`, async () => {
            try {
                const pinGuardado = localStorage.getItem('pinTemporalCaja') || "";
                let operacionCanje = campoDb === 'desc3Usado' ? 'canje_3' : 'canje_5';

                const respuesta = await fetch('https://nexo-backend-i9c1.onrender.com/api/caja/operacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pinIngresado: pinGuardado,
                        telefono: this.clienteActual.id,
                        operacion: operacionCanje
                    })
                });

                const data = await respuesta.json();
                
                if (!respuesta.ok) {
                    throw new Error(data.error || "Error al canjear el beneficio");
                }

                this.vibrar([100, 50, 100]); 
                this.clienteActual[campoDb] = true; 
                this.renderizarBotonesEspeciales(); 

            } catch(e) {
                this.mostrarAlerta(e.message || "Ocurrió un error al canjear el beneficio.");
                if(e.message.toLowerCase().includes("pin")) {
                    localStorage.removeItem('baristaAutorizado');
                    location.reload();
                }
            }
        });
    }

    async modificarSellos(cantidad) {
        if(cantidad === -1 && this.clienteActual.puntos <= 0) return;
        if(cantidad === 1 && this.clienteActual.puntos >= 8) return;

        const btn = cantidad === 1 ? document.getElementById('btnSumar') : document.getElementById('btnRestar');
        const btnOriginalText = btn.innerText;
        
        btn.innerText = "...";
        btn.disabled = true;

        try {
            const pinGuardado = localStorage.getItem('pinTemporalCaja') || "";

            // Llamada al backend de Render
            const respuesta = await fetch('https://nexo-backend-i9c1.onrender.com/api/caja/operacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pinIngresado: pinGuardado,
                    telefono: this.clienteActual.id,
                    cantidad: cantidad,
                    operacion: 'sumar_restar'
                })
            });

            const data = await respuesta.json();
            
            if (!respuesta.ok) {
                throw new Error(data.error || "Operación denegada por el servidor");
            }
            
            this.clienteActual.puntos += cantidad;
            this.actualizarVistaPuntos();
            
            if(cantidad === 1) {
                this.vibrar(50); 
                btn.classList.add('btn-success');
                btn.innerText = "¡Sumado! ✓";
            } else {
                this.vibrar([50, 50]);
                btn.innerText = "¡Restado! ✓";
            }

            setTimeout(() => {
                if (cantidad === 1) btn.classList.remove('btn-success');
                this.renderizarBotonesEspeciales(); 
                btn.disabled = false;
                btn.innerText = btnOriginalText;
            }, 1000);

        } catch(e) {
            this.mostrarAlerta(e.message || "Ocurrió un error al guardar el sello.");
            btn.disabled = false;
            btn.innerText = btnOriginalText;
            // Si el PIN falló, sacamos al empleado del sistema
            if(e.message.toLowerCase().includes("pin")) {
                localStorage.removeItem('baristaAutorizado');
                location.reload();
            }
        } 
    }

    canjearPremioFinal() {
        this.mostrarConfirmacion("¿Confirmas la entrega de la bebida gratis? Se reiniciará la tarjeta.", async () => {
            try {
                const pinGuardado = localStorage.getItem('pinTemporalCaja') || "";
                
                const respuesta = await fetch('https://nexo-backend-i9c1.onrender.com/api/caja/operacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pinIngresado: pinGuardado,
                        telefono: this.clienteActual.id,
                        operacion: 'canje_final'
                    })
                });

                const data = await respuesta.json();
                
                if (!respuesta.ok) {
                    throw new Error(data.error || "Error al reiniciar la tarjeta");
                }
                
                this.vibrar([100, 50, 100, 50, 200]); 
                this.mostrarAlerta("¡Premio registrado y tarjeta reiniciada!");
                this.volverABuscar(); 
            } catch(e) {
                this.mostrarAlerta(e.message || "Error al reiniciar la tarjeta.");
                if(e.message.toLowerCase().includes("pin")) {
                    localStorage.removeItem('baristaAutorizado');
                    location.reload();
                }
            }
        });
    }

    volverABuscar() {
        this.ui.acciones.style.display = 'none';
        this.ui.loader.style.display = 'none';
        this.ui.busqueda.style.display = 'block';
        document.getElementById('inputTelBusqueda').value = "";
        this.clienteActual = null;
        this.iniciarCamara();
    }
}

window.onload = () => {
    window.miCaja = new NexoCajaApp(); 
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker', err));
    });
}