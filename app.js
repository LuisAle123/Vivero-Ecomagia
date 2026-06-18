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
// CORREO DEL ADMINISTRADOR DEFINIDO
const ADMIN_EMAIL = "root@vivero.com"; 

// Referencias DOM
const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const authModal = document.getElementById('authModal');
const settingsModal = document.getElementById('settingsModal');

// --- MODO OSCURO (Ajustes) ---
const darkModeToggle = document.getElementById('darkModeToggle');

// Revisar si ya había escogido modo oscuro antes
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
        // UI Usuario Logueado
        loginBtn.classList.add('hidden');
        userProfileBadge.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName || "Sin Nombre";
        userAvatarBtn.src = user.photoURL || "https://u.cubeupload.com/LAUIS46/defaultimage.png";
        
        // Modal de Ajustes UI
        editProfileArea.classList.remove('hidden');
        settingsLoginPrompt.classList.add('hidden');

        // Mostrar Panel de Admin solo si es el root
        if (user.email === ADMIN_EMAIL) {
            adminPanel.classList.remove('hidden');
        } else {
            adminPanel.classList.add('hidden');
        }
    } else {
        // UI Usuario Deslogueado
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
        // Crear el usuario en Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        // Actualizar su perfil inmediatamente con su Nickname
        await updateProfile(userCredential.user, {
            displayName: nick,
            photoURL: "https://via.placeholder.com/150" // Foto por defecto
        });
        
        authModal.classList.add('hidden');
        alert('Cuenta creada exitosamente. ¡Bienvenido!');
        // Forzar recarga de UI
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
    submitBtn.textContent = "Guardando..."; submitBtn.disabled = true;

    try {
        const file = document.getElementById('prodImage').files[0];
        const storageRef = ref(storage, `productos/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(snapshot.ref);

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
        submitBtn.textContent = "Agregar Producto"; submitBtn.disabled = false;
    }
});

window.addToCart = function(id) { alert('Próximamente: Producto ID ' + id + ' al carrito.'); };

listenToProducts();
