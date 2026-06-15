import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Pega aquí la config de tu NUEVO proyecto
const firebaseConfig = {
    apiKey: "AIzaSyCaRjUHg17Etkk5DXw9s_H1psK8aVQNUn8",
    authDomain: "nexo-cafe-82913.firebaseapp.com",
    projectId: "nexo-cafe-82913",
    storageBucket: "nexo-cafe-82913.appspot.com",
    messagingSenderId: "458906141634",
    appId: "1:458906141634:web:70a01ff527cecbe29f4c5b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);