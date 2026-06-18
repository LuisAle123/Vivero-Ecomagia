import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Configuración Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDzUgxYZsbwtzRQfUaaZ2Pw6u9XTHUnxrQ",
    authDomain: "vivero-ecomagia.firebaseapp.com",
    projectId: "vivero-ecomagia",
    storageBucket: "vivero-ecomagia.firebasestorage.app",
    messagingSenderId: "34943463295",
    appId: "1:34943463295:web:0ffd562131eb2eb06a744a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Variables globales
let products = [];
let cart = []; // Arreglo para guardar el carrito
const ADMIN_EMAIL = "root@vivero.com"; 

// Referencias DOM principales
const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const authModal = document.getElementById('authModal');
const settingsModal = document.getElementById('settingsModal');
const cartModal = document.getElementById('cartModal');

// --- MODO OSCURO (Ajustes) ---
const darkModeToggle = document.getElementById('darkModeToggle');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
}

darkModeToggle.addEventListener('change', (e) => {
    if(e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
});

// --- RENDERIZADO DEL CATÁLOGO ---
function calculateDiscount(oldP, newP) {
    if (!newP || newP >= oldP) return 0;
    return Math.round(((oldP - newP) / oldP) * 100);
}

function generateStars(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) { starsHtml += i <= Math.round(rating) ? '★' : '☆'; }
    return starsHtml;
}

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
            <div class="stars">${generateStars(p.rating)}</div>
            <div>
                ${discountPercentage > 0 ? `<span class="old-price">$${p.oldPrice}</span>` : ''}
                <span class="price">$${p.newPrice || p.oldPrice}</span>
            </div>
            <button class="action-btn" onclick="addToCart('${p.id}')">Añadir al carrito</button>
        `;
        catalog.appendChild(card);
    });
}

function listenToProducts() {
    onSnapshot(collection(db, "plantas"), (snapshot) => {
        products = [];
        snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        renderProducts();
    });
}

// --- ESTADO DE AUTENTICACIÓN Y PERFIL ---
onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('loginBtn');
    const userProfileBadge = document.getElementById('userProfileBadge');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userAvatarBtn = document.getElementById('userAvatarBtn');
    const editProfileArea = document.getElementById('editProfileArea');
    const settingsLoginPrompt = document.getElementById('settingsLoginPrompt');

    if (user) {
        loginBtn.classList.add('hidden');
        userProfileBadge.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName || "Sin Nombre";
        userAvatarBtn.src = user.photoURL || "https://u.cubeupload.com/LAUIS46/defaultimage.png";
        
        editProfileArea.classList.remove('hidden');
        settingsLoginPrompt.classList.add('hidden');

        if (user.email === ADMIN_EMAIL) {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }
    } else {
        loginBtn.classList.remove('hidden');
        userProfileBadge.classList.add('hidden');
        adminPanel.classList.add('hidden');
        editProfileArea.classList.add('hidden');
        settingsLoginPrompt.classList.remove('hidden');
    }
});

// --- LÓGICA DE INTERFAZ DE MODALES ---
document.getElementById('loginBtn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('cartBtn').addEventListener('click', () => cartModal.classList.remove('hidden'));

// Cierra cualquier modal dinámicamente
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden'));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
    alert('Sesión cerrada correctamente');
});

// Cambiar entre Login y Registro
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginFormArea = document.getElementById('loginFormArea');
const registerFormArea = document.getElementById('registerFormArea');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginFormArea.classList.remove('hidden'); registerFormArea.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerFormArea.classList.remove('hidden'); loginFormArea.classList.add('hidden');
});

// --- SISTEMA DE LOGIN Y REGISTRO ---
document.getElementById('submitLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        authModal.classList.add('hidden');
    } catch (error) {
        alert('Error al iniciar sesión: Revisa tus datos.');
    }
});

document.getElementById('submitRegister').addEventListener('click', async () => {
    const nick = document.getElementById('regNickname').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    
    if(pass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(userCredential.user, {
            displayName: nick,
            photoURL: "https://u.cubeupload.com/LAUIS46/defaultimage.png" 
        });
        
        authModal.classList.add('hidden');
        alert('Cuenta creada exitosamente. ¡Bienvenido!');
        window.location.reload(); 
    } catch (error) {
        alert('Error al crear cuenta: ' + error.message);
    }
});

// --- EDITAR PERFIL ---
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const newNick = document.getElementById('editNickname').value;
    const newAvatar = document.getElementById('editAvatarUrl').value;
    const user = auth.currentUser;

    if(user) {
        try {
            await updateProfile(user, {
                displayName: newNick || user.displayName,
                photoURL: newAvatar || user.photoURL
            });
            alert('Perfil actualizado con éxito');
            settingsModal.classList.add('hidden');
            window.location.reload();
        } catch (error) {
            alert('Error al actualizar el perfil');
        }
    }
});

// --- AGREGAR PRODUCTO (ADMIN) ---
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = "Guardando..."; 
    submitBtn.disabled = true;

    try {
        const imageUrl = document.getElementById('prodImage').value;

        await addDoc(collection(db, "plantas"), {
            name: document.getElementById('prodName').value,
            description: document.getElementById('prodDesc').value,
            oldPrice: parseFloat(document.getElementById('prodOldPrice').value),
            newPrice: parseFloat(document.getElementById('prodNewPrice').value) || null,
            image: imageUrl,
            stock: parseInt(document.getElementById('prodStock').value),
            rating: 0,
            createdAt: new Date()
        });

        alert('Producto agregado exitosamente.');
        e.target.reset();
    } catch (error) {
        alert('Error al guardar el producto.');
    } finally {
        submitBtn.textContent = "Agregar Producto"; 
        submitBtn.disabled = false;
    }
});

// --- SISTEMA DEL CARRITO ---
window.addToCart = function(id) {
    // 1. Verificamos si el usuario tiene sesión iniciada
    if (!auth.currentUser) {
        alert("¡Hola! Debes iniciar sesión o registrarte para añadir plantas a tu carrito.");
        authModal.classList.remove('hidden'); // Le abrimos el modal automáticamente
        return;
    }

    // 2. Buscamos la planta en la base de datos local y la añadimos
    const product = products.find(p => p.id === id);
    if (product) {
        cart.push(product);
        updateCartUI();
        alert(`${product.name} añadido a tu carrito 🌿`);
    }
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartUI();
};

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotalDisplay = document.getElementById('cartTotal');

    cartCount.textContent = cart.length;
    cartItemsContainer.innerHTML = '';
    
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-muted">Tu carrito está vacío.</p>';
    } else {
        cart.forEach((item, index) => {
            const price = item.newPrice || item.oldPrice;
            total += price;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <strong>${item.name}</strong><br>
                    $${price}
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">X</button>
            `;
            cartItemsContainer.appendChild(div);
        });
    }

    cartTotalDisplay.textContent = total.toFixed(2);
}

document.getElementById('checkoutBtn').addEventListener('click', () => {
    if(cart.length === 0) return alert("Tu carrito está vacío.");
    alert("Próximamente: Pasarela de Pago integrada.");
});

// Inicializar la lectura de datos
listenToProducts();
