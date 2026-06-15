import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class RamblaApp {
    constructor() {
        this.db = db;
        this.unsubscribe = null;
        
        this.puntosAnteriores = -1;
        this.primeraCarga = true;

        this.ui = {
            skeleton: document.getElementById('pantallaSkeleton'),
            registro: document.getElementById('pantallaRegistro'),
            tarjeta: document.getElementById('pantallaTarjeta'),
            nombre: document.getElementById('displayNombre'),
            telLabel: document.getElementById('displayTelLabel'),
            qr: document.getElementById('qrImage'), // Volvemos al elemento img
            gridSellos: document.getElementById('gridSellos'),
            puntos: document.getElementById('displayPuntos'),
            premio: document.getElementById('displayPremio'),
            modalAlerta: document.getElementById('modalAlertaCustom'),
            textoAlerta: document.getElementById('textoAlertaCustom'),
            status3: document.getElementById('refStatus3'),
            status5: document.getElementById('refStatus5')
        };

        this.vincularEventos();
        this.iniciar();
    }

    vincularEventos() {
        document.getElementById('btnCrearTarjeta').addEventListener('click', () => this.ingresar());
        document.getElementById('btnCerrarSesion').addEventListener('click', () => this.cerrarSesion());
        
        document.getElementById('btnCerrarAlerta').addEventListener('click', () => {
            this.ui.modalAlerta.style.display = 'none';
        });
    }

    mostrarAlerta(mensaje) {
        this.ui.textoAlerta.innerText = mensaje;
        this.ui.modalAlerta.style.display = 'flex';
    }

    iniciar() {
        const celularLocal = localStorage.getItem('miTarjetaNexoTEL');
        if (celularLocal) {
            this.cambiarPantalla('skeleton'); 
            this.abrirTarjeta(celularLocal);
        } else {
            this.cambiarPantalla('registro');
        }
    }

    cambiarPantalla(pantalla) {
        this.ui.skeleton.style.display = pantalla === 'skeleton' ? 'block' : 'none';
        this.ui.registro.style.display = pantalla === 'registro' ? 'block' : 'none';
        this.ui.tarjeta.style.display = pantalla === 'tarjeta' ? 'block' : 'none';
    }

    formatearNombre(texto) {
        if (!texto) return "";
        return texto.trim().toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase());
    }

    async ingresar() {
        const nombreIngresado = document.getElementById('inputNombre').value;
        const nombre = this.formatearNombre(nombreIngresado);
        let celular = document.getElementById('inputCelular').value.trim();

        if(!nombre || !celular) return this.mostrarAlerta("Por favor completa tu nombre y número para continuar.");
        
        celular = celular.replace(/\D/g,''); 
        if(celular.length < 8) return this.mostrarAlerta("El número de WhatsApp es demasiado corto. Revisa que esté bien escrito.");

        this.cambiarPantalla('skeleton');

        try {
            const docRef = doc(this.db, "clientes", celular);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                await setDoc(docRef, { nombre: nombre }, { merge: true });
            } else {
                await setDoc(docRef, { 
                    nombre: nombre, 
                    puntos: 0,
                    desc3Usado: false,
                    desc5Usado: false,
                    fechaRegistro: new Date().toISOString()
                });
            }
            
            localStorage.setItem('miTarjetaNexoTEL', celular);
            this.abrirTarjeta(celular);
        } catch (e) {
            console.error("Error:", e);
            this.mostrarAlerta("Hubo un error de conexión. Revisa tu internet e intenta de nuevo.");
            this.cambiarPantalla('registro');
        }
    }

    abrirTarjeta(celular) {
        // --- RESTAURAMOS EL QR ORIGINAL VÍA API ---
        this.ui.qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${celular}&bgcolor=EFEFEF&color=000000`;
        this.ui.telLabel.innerText = `******${celular.slice(-4)}`;

        this.unsubscribe = onSnapshot(doc(this.db, "clientes", celular), (docSnap) => {
            if (docSnap.exists()) {
                const datos = docSnap.data();
                this.ui.nombre.innerText = datos.nombre;
                
                if(this.primeraCarga) {
                    setTimeout(() => {
                        this.cambiarPantalla('tarjeta');
                        this.renderizarTazas(datos);
                    }, 50);
                } else {
                    this.renderizarTazas(datos);
                }
            } else {
                this.cerrarSesion(); 
            }
        });
    }

    renderizarTazas(datos) {
        const puntosActuales = datos.puntos || 0;
        const desc3Usado = datos.desc3Usado || false;
        const desc5Usado = datos.desc5Usado || false;
        const totalTazas = 8; 
        
        const puntosPrevios = this.puntosAnteriores;
        const animarNuevos = !this.primeraCarga && puntosActuales > puntosPrevios;

        this.ui.gridSellos.innerHTML = ''; 

        for (let i = 1; i <= totalTazas; i++) {
            const contenedorSvg = document.createElement('div');
            
            if (i === 3) {
                contenedorSvg.innerHTML = this.obtenerSvgDiscount();
            } else if (i === 5) {
                contenedorSvg.innerHTML = this.obtenerSvgBolt();
            } else {
                contenedorSvg.innerHTML = this.obtenerSvgTaza();
            }
            
            const svgElement = contenedorSvg.querySelector('svg'); 
            
            if (i === 3 || i === 5 || i === 8) {
                svgElement.classList.add('sello-especial');
            }
            
            if (i <= puntosActuales) {
                setTimeout(() => {
                    svgElement.classList.add('filled');
                    
                    if (animarNuevos && i > puntosPrevios) {
                        setTimeout(() => this.dispararParticulas(svgElement), 150);
                    }
                }, 50);
            }
            
            this.ui.gridSellos.appendChild(svgElement);
        }

        this.ui.status3.innerText = desc3Usado ? "Canjeado ✓" : (puntosActuales >= 3 ? "Disponible" : "");
        this.ui.status3.style.color = desc3Usado ? "var(--dark)" : "var(--verde-chill)";
        
        this.ui.status5.innerText = desc5Usado ? "Canjeado ✓" : (puntosActuales >= 5 ? "Disponible" : "");
        this.ui.status5.style.color = desc5Usado ? "var(--dark)" : "var(--verde-chill)";

        this.ui.puntos.innerText = puntosActuales;
        
        if(puntosActuales >= totalTazas) {
            this.ui.premio.innerText = "¡Bebida gratis lista!";
            this.ui.premio.classList.add('premio-listo'); 
            
            if(animarNuevos || this.primeraCarga) {
                this.dispararConfetti();
            }
        } else {
            this.ui.premio.innerText = "En progreso";
            this.ui.premio.classList.remove('premio-listo');
        }

        this.puntosAnteriores = puntosActuales;
        this.primeraCarga = false;
    }

    dispararParticulas(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 6; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.willChange = 'transform, opacity'; 
            document.body.appendChild(p);

            const angle = Math.random() * Math.PI * 2;
            const velocity = 25 + Math.random() * 35;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity - 15; 

            p.style.left = centerX + 'px';
            p.style.top = centerY + 'px';

            p.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
            ], {
                duration: 600 + Math.random() * 300,
                easing: 'cubic-bezier(0, .9, .57, 1)',
                fill: 'forwards'
            });

            setTimeout(() => p.remove(), 1000); 
        }
    }

    dispararConfetti() {
        const container = document.getElementById('confettiContainer');
        if(!container) return;
        
        const colors = ['#000000', '#FFFFFF', '#8DE055', '#444444'];
        const shapes = ['circle', 'square', 'triangle'];

        for (let i = 0; i < 40; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.willChange = 'transform, opacity'; 
            
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 8 + Math.random() * 8;
            
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';
            confetti.style.background = color;
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-20px';
            
            if (shape === 'circle') {
                confetti.style.borderRadius = '50%';
            } else if (shape === 'triangle') {
                confetti.style.width = '0';
                confetti.style.height = '0';
                confetti.style.background = 'transparent';
                confetti.style.borderLeft = size/2 + 'px solid transparent';
                confetti.style.borderRight = size/2 + 'px solid transparent';
                confetti.style.borderBottom = size + 'px solid ' + color;
            }

            container.appendChild(confetti);

            const duration = 2000 + Math.random() * 2000;
            const delay = Math.random() * 500;

            confetti.animate([
                { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
                { transform: `translateY(${window.innerHeight + 50}px) rotate(${360 + Math.random() * 720}deg)`, opacity: 0.8 }
            ], {
                duration: duration,
                delay: delay,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            });

            setTimeout(() => confetti.remove(), duration + delay + 100);
        }
    }

    obtenerSvgDiscount() {
        return `
        <svg class="stamp-discount" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path class="discount-bg" d="M2 12a10 10 0 1 0 20 0 10 10 0 1 0 -20 0"></path>
            <path class="discount-symbol" d="m15 9 -6 6 M9 9h0.01 M15 15h0.01"></path>
        </svg>`;
    }
    
    obtenerSvgBolt() {
        return `
        <svg class="stamp-bolt" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path class="bolt-main" d="m11.4251 14.3501 -6.80002 -0.8c-0.31667 -0.03335 -0.525 -0.20415 -0.625 -0.5125 -0.1 -0.30835 -0.033335 -0.57085 0.2 -0.7875l11.00002 -10.1c0.06665 -0.05 0.1375 -0.09167 0.2125 -0.125 0.075 -0.033335 0.1875 -0.05 0.3375 -0.05 0.25 0 0.44165 0.104165 0.575 0.3125 0.1333 0.20833 0.1333 0.42083 0 0.6375l-3.75 6.725 6.8 0.8c0.31665 0.03335 0.525 0.20415 0.625 0.5125 0.1 0.30835 0.0333 0.57085 -0.2 0.7875l-11 10.1c-0.0667 0.05 -0.1375 0.09165 -0.2125 0.125 -0.075 0.03335 -0.1875 0.05 -0.3375 0.05 -0.25 0 -0.4417 -0.10415 -0.575 -0.3125 -0.13335 -0.20835 -0.13335 -0.42085 0 -0.6375l3.75 -6.725Z"></path>
        </svg>`;
    }

    obtenerSvgTaza() {
        return `
        <svg class="stamp-cup" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path class="steam-path" d="M38,30 V12 M50,32 V8 M62,30 V16" stroke-linecap="round"/>
            <path class="cup-path" d="M20,35 H80 V75 Q80,90 65,90 H35 Q20,90 20,75 Z" />
            <path class="coffee-fill" d="M22,37 H78 V73 Q78,88 63,88 H37 Q22,88 22,73 Z" />
            <path class="cup-handle" d="M80,45 Q95,45 95,60 T80,75" />
        </svg>`;
    }

    cerrarSesion() {
        if (this.unsubscribe) this.unsubscribe(); 
        localStorage.removeItem('miTarjetaNexoTEL');
        location.reload();
    }
}

new RamblaApp();

// --- LÓGICA DE INSTALACIÓN PWA ACTUALIZADA PARA FORZAR LA APARICIÓN ---
let eventoInstalacion = null;
const btnInstalar = document.getElementById('btnInstalarApp');

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    console.log(" beforeinstallprompt detectado!");
    e.preventDefault(); 
    eventoInstalacion = e;
    
    if(btnInstalar) {
        btnInstalar.style.display = 'block'; 
        btnInstalar.innerText = "Instalar app en tu celular"; 
    }
});

if(btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
        if (!eventoInstalacion) {
            console.log("El navegador no permite la instalación manual en este momento.");
            this.mostrarAlerta("La app parece estar ya instalada o tu navegador no soporta la instalación rápida. Revisa el menú de tu navegador y busca 'Instalar o Agregar a pantalla principal'.");
            return;
        }
        eventoInstalacion.prompt(); 
        const { outcome } = await eventoInstalacion.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        if (outcome === 'accepted') {
            btnInstalar.style.display = 'none'; 
        }
        eventoInstalacion = null;
    });
}

window.addEventListener('appinstalled', () => {
    console.log("App instalada con éxito!");
    if(btnInstalar) btnInstalar.style.display = 'none';
});
