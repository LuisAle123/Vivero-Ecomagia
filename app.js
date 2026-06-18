import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// NUEVOS IMPORTS: doc, getDoc, updateDoc y arrayUnion
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

let products = [];
// RECUPERAR CARRITO DE LOCALSTORAGE AL INICIAR
let cart = JSON.parse(localStorage.getItem('vivero_cart')) || []; 
const ADMIN_EMAIL = "root@vivero.com"; 

const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const authModal = document.getElementById('authModal');
const settingsModal = document.getElementById('settingsModal');
const cartModal = document.getElementById('cartModal');
const reviewsModal = document.getElementById('reviewsModal');

// --- MODO OSCURO ---
const darkModeToggle = document.getElementById('darkModeToggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
}
darkModeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
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
        
        // Calcular promedio de reseñas
        let avgRating = 0;
        const reviews = p.reviews || [];
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
            avgRating = sum / reviews.length;
        }

        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Bloquear botón si no hay stock
        const btnEstado = p.stock > 0 ? `<button class="action-btn" onclick="addToCart('${p.id}')">Añadir al carrito</button>` 
                                      : `<button class="action-btn" disabled style="background:gray;">Agotado</button>`;

        card.innerHTML = `
            ${discountPercentage > 0 ? `<div class="discount-badge">¡-${discountPercentage}%!</div>` : ''}
            <img src="${p.image}" alt="${p.name}">
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <div class="stars">${generateStars(avgRating)} <small>(${reviews.length})</small></div>
            
            <div style="margin-bottom: 10px;">
                ${discountPercentage > 0 ? `<span class="price-label">Precio Original: <span class="old-price">$${p.oldPrice}</span></span>` : ''}
                <span class="price-label ${discountPercentage > 0 ? 'price-oferta' : 'price'}">
                    ${discountPercentage > 0 ? 'Precio Oferta: ' : 'Precio: '}$${p.newPrice || p.oldPrice}
                </span>
            </div>
            
            <p class="stock-label">Stock: ${p.stock} disponibles</p>
            
            ${btnEstado}
            <button class="action-btn btn-secondary" onclick="openReviews('${p.id}')">Ver reseñas</button>
        `;
        catalog.appendChild(card);
    });
}

function listenToProducts() {
    onSnapshot(collection(db, "plantas"), (snapshot) => {
        products = [];
        snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        renderProducts();
        updateCartUI(); // Actualizar interfaz por si cambió algún precio
    });
}

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('loginBtn');
    const userProfileBadge = document.getElementById('userProfileBadge');
    
    if (user) {
        loginBtn.classList.add('hidden');
        userProfileBadge.classList.remove('hidden');
        document.getElementById('userNameDisplay').textContent = user.displayName || "Sin Nombre";
        document.getElementById('userAvatarBtn').src = user.photoURL || "https://u.cubeupload.com/LAUIS46/defaultimage.png";
        
        document.getElementById('editProfileArea').classList.remove('hidden');
        document.getElementById('settingsLoginPrompt').classList.add('hidden');
        
        document.getElementById('addReviewArea').classList.remove('hidden');
        document.getElementById('reviewLoginPrompt').classList.add('hidden');

        adminPanel.classList.toggle('hidden', user.email !== ADMIN_EMAIL);
    } else {
        loginBtn.classList.remove('hidden');
        userProfileBadge.classList.add('hidden');
        adminPanel.classList.add('hidden');
        
        document.getElementById('editProfileArea').classList.add('hidden');
        document.getElementById('settingsLoginPrompt').classList.remove('hidden');
        
        document.getElementById('addReviewArea').classList.add('hidden');
        document.getElementById('reviewLoginPrompt').classList.remove('hidden');
    }
});

// Botones y Modales
document.getElementById('loginBtn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('cartBtn').addEventListener('click', () => cartModal.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));

// --- SISTEMA DEL CARRITO ---
window.addToCart = function(id) {
    if (!auth.currentUser) {
        alert("¡Hola! Debes iniciar sesión o registrarte para añadir plantas a tu carrito.");
        authModal.classList.remove('hidden');
        return;
    }

    const product = products.find(p => p.id === id);
    if (product) {
        // Verificar si la cantidad en el carrito supera el stock
        const currentInCart = cart.filter(item => item.id === id).length;
        if(currentInCart >= product.stock) {
            alert(`No puedes añadir más de este producto. El stock máximo es ${product.stock}.`);
            return;
        }

        cart.push(product);
        localStorage.setItem('vivero_cart', JSON.stringify(cart)); // Guardar en memoria
        updateCartUI();
        alert(`${product.name} añadido a tu carrito 🌿`);
    }
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    localStorage.setItem('vivero_cart', JSON.stringify(cart)); // Actualizar memoria
    updateCartUI();
};

function updateCartUI() {
    document.getElementById('cartCount').textContent = cart.length;
    const container = document.getElementById('cartItemsContainer');
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-muted">Tu carrito está vacío.</p>';
    } else {
        container.innerHTML = '';
        cart.forEach((item, index) => {
            const price = item.newPrice || item.oldPrice;
            total += price;
            container.innerHTML += `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-details">
                        <strong>${item.name}</strong><br>$${price}
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart(${index})">X</button>
                </div>
            `;
        });
    }
    document.getElementById('cartTotal').textContent = total.toFixed(2);
}

// COBRAR Y RESTAR STOCK
document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if(cart.length === 0) return alert("Tu carrito está vacío.");
    
    const btn = document.getElementById('checkoutBtn');
    btn.textContent = "Procesando..."; btn.disabled = true;

    try {
        // Agrupar items para restar el stock correctamente
        const itemCounts = {};
        cart.forEach(item => itemCounts[item.id] = (itemCounts[item.id] || 0) + 1);

        for (let id in itemCounts) {
            const productRef = doc(db, "plantas", id);
            const pDoc = await getDoc(productRef);
            
            if(pDoc.exists()) {
                let currentStock = pDoc.data().stock;
                let newStock = currentStock - itemCounts[id];
                if(newStock < 0) newStock = 0;
                
                await updateDoc(productRef, { stock: newStock });
            }
        }

        alert("¡Pago con éxito! 🌿 Gracias por tu compra.");
        cart = []; // Vaciar carrito
        localStorage.removeItem('vivero_cart'); // Vaciar F5
        updateCartUI();
        cartModal.classList.add('hidden');

    } catch (error) {
        alert("Ocurrió un error al procesar el pago.");
        console.error(error);
    } finally {
        btn.textContent = "Proceder al Pago"; btn.disabled = false;
    }
});

// --- SISTEMA DE RESEÑAS ---
let currentReviewProductId = null;

window.openReviews = function(id) {
    const product = products.find(p => p.id === id);
    if(!product) return;

    currentReviewProductId = id;
    document.getElementById('reviewProductName').textContent = `Reseñas: ${product.name}`;
    
    const list = document.getElementById('reviewsList');
    list.innerHTML = '';

    const reviews = product.reviews || [];
    if(reviews.length === 0) {
        list.innerHTML = '<p class="text-muted">Aún no hay reseñas. ¡Sé el primero en opinar!</p>';
    } else {
        reviews.forEach(r => {
            list.innerHTML += `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-author">${r.userName}</span>
                        <span>${generateStars(r.rating)}</span>
                    </div>
                    <div class="review-text">${r.text}</div>
                </div>
            `;
        });
    }

    reviewsModal.classList.remove('hidden');
};

document.getElementById('submitReviewBtn').addEventListener('click', async () => {
    if(!auth.currentUser) return alert("Debes iniciar sesión.");
    
    const text = document.getElementById('reviewTextInput').value;
    const rating = parseInt(document.getElementById('reviewStarSelect').value);
    
    if(text.trim() === '') return alert("Por favor escribe un comentario.");

    const btn = document.getElementById('submitReviewBtn');
    btn.textContent = "Guardando..."; btn.disabled = true;

    try {
        const productRef = doc(db, "plantas", currentReviewProductId);
        // arrayUnion agrega la reseña al arreglo "reviews" en Firebase
        await updateDoc(productRef, {
            reviews: arrayUnion({
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || "Usuario Anónimo",
                text: text,
                rating: rating,
                date: new Date().toISOString()
            })
        });

        alert("¡Gracias por tu reseña!");
        document.getElementById('reviewTextInput').value = '';
        reviewsModal.classList.add('hidden');
    } catch (error) {
        alert("Error al publicar la reseña.");
        console.error(error);
    } finally {
        btn.textContent = "Publicar Reseña"; btn.disabled = false;
    }
});

// --- AGREGAR PRODUCTO (ADMIN) ---
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = "Guardando..."; btn.disabled = true;

    try {
        await addDoc(collection(db, "plantas"), {
            name: document.getElementById('prodName').value,
            description: document.getElementById('prodDesc').value,
            oldPrice: parseFloat(document.getElementById('prodOldPrice').value),
            newPrice: parseFloat(document.getElementById('prodNewPrice').value) || null,
            image: document.getElementById('prodImage').value,
            stock: parseInt(document.getElementById('prodStock').value),
            reviews: [], // Inicializamos las reseñas vacías
            createdAt: new Date()
        });

        alert('Producto agregado.');
        e.target.reset();
    } catch (error) {
        alert('Error al guardar.');
    } finally {
        btn.textContent = "Agregar Producto"; btn.disabled = false;
    }
});

// RESTO DE LÓGICA (Login y Perfil se mantienen igual)
document.getElementById('logoutBtn').addEventListener('click', () => { signOut(auth); alert('Sesión cerrada'); });
const tabLogin = document.getElementById('tabLogin'); const tabRegister = document.getElementById('tabRegister');
const loginFormArea = document.getElementById('loginFormArea'); const registerFormArea = document.getElementById('registerFormArea');
tabLogin.addEventListener('click', () => { tabLogin.classList.add('active'); tabRegister.classList.remove('active'); loginFormArea.classList.remove('hidden'); registerFormArea.classList.add('hidden'); });
tabRegister.addEventListener('click', () => { tabRegister.classList.add('active'); tabLogin.classList.remove('active'); registerFormArea.classList.remove('hidden'); loginFormArea.classList.add('hidden'); });

document.getElementById('submitLogin').addEventListener('click', async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); authModal.classList.add('hidden'); } catch (error) { alert('Error al iniciar sesión.'); }
});

document.getElementById('submitRegister').addEventListener('click', async () => {
    try {
        const cred = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value, document.getElementById('regPassword').value);
        await updateProfile(cred.user, { displayName: document.getElementById('regNickname').value, photoURL: "https://u.cubeupload.com/LAUIS46/defaultimage.png" });
        window.location.reload(); 
    } catch (error) { alert('Error: ' + error.message); }
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    try {
        await updateProfile(auth.currentUser, { displayName: document.getElementById('editNickname').value || auth.currentUser.displayName, photoURL: document.getElementById('editAvatarUrl').value || auth.currentUser.photoURL });
        window.location.reload();
    } catch (error) { alert('Error al actualizar'); }
});

listenToProducts();
