// Importar las funciones necesarias de los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// Estado global (ahora se llenará desde Firestore)
let products = [];
let isAdmin = false;

// Referencias del DOM
const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('loginBtn');

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
            <button onclick="addToCart('${p.id}')">Añadir al carrito</button>
        `;
        catalog.appendChild(card);
    });
}

// Escuchar cambios en la base de datos en tiempo real (Sustituye al renderProducts() inicial)
function listenToProducts() {
    const productCollection = collection(db, "plantas");
    // onSnapshot actualiza la vista automáticamente si agregas o borras algo en la BD
    onSnapshot(productCollection, (snapshot) => {
        products = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderProducts();
    });
}

// --- LÓGICA DE AUTENTICACIÓN REAL ---

// Escucha si el usuario entra o sale de su cuenta
onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        adminPanel.classList.remove('hidden');
        loginBtn.textContent = "Cerrar Sesión";
    } else {
        isAdmin = false;
        adminPanel.classList.add('hidden');
        loginBtn.textContent = "Ingresar / Admin";
    }
});

// Controlar el botón del header
loginBtn.addEventListener('click', () => {
    if (isAdmin) {
        signOut(auth);
        alert('Sesión cerrada');
    } else {
        loginModal.classList.remove('hidden');
    }
});

document.getElementById('closeLogin').addEventListener('click', () => loginModal.classList.add('hidden'));

// Iniciar sesión conectándose a Firebase
document.getElementById('submitLogin').addEventListener('click', async () => {
    // ATENCIÓN: El input 'username' ahora debe recibir un CORREO electrónico registrado en Firebase
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        loginModal.classList.add('hidden');
        alert('Bienvenido al panel de administración');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    } catch (error) {
        alert('Credenciales incorrectas o usuario no registrado.');
        console.error("Error de Auth: ", error.message);
    }
});

// --- LÓGICA PARA AGREGAR PRODUCTOS ---
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Cambiar estado del botón para indicar que está subiendo
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = "Guardando...";
    submitBtn.disabled = true;

    try {
        const name = document.getElementById('prodName').value;
        const description = document.getElementById('prodDesc').value;
        const oldPrice = parseFloat(document.getElementById('prodOldPrice').value);
        const newPrice = parseFloat(document.getElementById('prodNewPrice').value) || null;
        const stock = parseInt(document.getElementById('prodStock').value);
        
        let imageUrl = "";
        const imageInput = document.getElementById('prodImage');

        // Comprueba si el input es de tipo archivo (para subir a Storage) o texto (URL directa)
        if (imageInput.type === 'file' && imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const storageRef = ref(storage, `productos/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(snapshot.ref);
        } else {
            imageUrl = imageInput.value;
        }

        // Crear el documento en la colección "plantas" de Firestore
        await addDoc(collection(db, "plantas"), {
            name: name,
            description: description,
            oldPrice: oldPrice,
            newPrice: newPrice,
            image: imageUrl || "https://via.placeholder.com/500",
            stock: stock,
            rating: 0, 
            createdAt: new Date()
        });

        alert('Producto agregado exitosamente.');
        e.target.reset();
    } catch (error) {
        console.error("Error al agregar producto: ", error);
        alert('Error al guardar el producto. Revisa la consola o las reglas de Firebase.');
    } finally {
        // Restaurar el botón
        submitBtn.textContent = "Agregar Producto";
        submitBtn.disabled = false;
    }
});

// --- LÓGICA DEL CARRITO ---
// Como el script es de tipo "module", necesitamos exponer la función globalmente para el onclick del HTML
window.addToCart = function(id) {
    alert('Función de carrito en desarrollo. ID del producto: ' + id);
};

// Iniciar la lectura de datos de la nube
listenToProducts();
