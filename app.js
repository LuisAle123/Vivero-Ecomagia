// Importar las funciones necesarias de los SDKs que necesitas
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Configuración de Firebase de tu aplicación
const firebaseConfig = {
    apiKey: "AIzaSyDzUgxYZsbwtzRQfUaaZ2Pw6u9XTHUnxrQ",
    authDomain: "vivero-ecomagia.firebaseapp.com",
    projectId: "vivero-ecomagia",
    storageBucket: "vivero-ecomagia.firebasestorage.app",
    messagingSenderId: "34943463295",
    appId: "1:34943463295:web:0ffd562131eb2eb06a744a",
    measurementId: "G-VVWGN6V6EX"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Base de datos simulada en memoria
let products = [
    {
        id: 1,
        name: "Monstera Deliciosa",
        description: "Planta de interior resistente.",
        oldPrice: 350,
        newPrice: 280, // Tiene descuento
        image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=500",
        stock: 15,
        rating: 4.5
    }
];

let isAdmin = false;

// Referencias del DOM
const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const loginModal = document.getElementById('loginModal');

// Función para calcular el descuento
function calculateDiscount(oldP, newP) {
    if (!newP || newP >= oldP) return 0;
    const discount = ((oldP - newP) / oldP) * 100;
    return Math.round(discount);
}

// Función para generar estrellas de calificación
function generateStars(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        starsHtml += i <= Math.round(rating) ? '★' : '☆';
    }
    return starsHtml;
}

// Renderizar el catálogo
function renderProducts() {
    catalog.innerHTML = '';
    products.forEach(p => {
        const discountPercentage = calculateDiscount(p.oldPrice, p.newPrice);
        
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            ${discountPercentage > 0 ? `<div class="discount-badge">¡-${discountPercentage}%!</div>` : ''}
            <img src="${p.image}" alt="${p.name}">
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <div class="stars">${generateStars(p.rating)} (${p.rating})</div>
            <div>
                ${discountPercentage > 0 ? `<span class="old-price">$${p.oldPrice}</span>` : ''}
                <span class="price">$${p.newPrice || p.oldPrice}</span>
            </div>
            <p><small>Stock: ${p.stock}</small></p>
            <button onclick="addToCart(${p.id})">Añadir al carrito</button>
        `;
        catalog.appendChild(card);
    });
}

// Lógica del Login (Simulada e Insegura - Solo para el prototipo)
document.getElementById('loginBtn').addEventListener('click', () => loginModal.classList.remove('hidden'));
document.getElementById('closeLogin').addEventListener('click', () => loginModal.classList.add('hidden'));

document.getElementById('submitLogin').addEventListener('click', () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user === 'root' && pass === 'admin') {
        isAdmin = true;
        adminPanel.classList.remove('hidden');
        loginModal.classList.add('hidden');
        alert('Sesión iniciada como Administrador');
    } else {
        alert('Usuario regular o credenciales incorrectas (La creación de cuentas requiere backend)');
    }
});

// Lógica para agregar productos (Admin)
document.getElementById('addProductForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newProduct = {
        id: Date.now(),
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        oldPrice: parseFloat(document.getElementById('prodOldPrice').value),
        newPrice: parseFloat(document.getElementById('prodNewPrice').value) || null,
        image: document.getElementById('prodImage').value,
        stock: parseInt(document.getElementById('prodStock').value),
        rating: 0 // Nuevo producto no tiene reseñas iniciales
    };
    
    products.push(newProduct);
    renderProducts();
    e.target.reset();
});

function addToCart(id) {
    // Aquí iría la lógica del carrito
    alert('Producto añadido al carrito');
}

// Inicializar página
renderProducts();