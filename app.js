import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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

let products = [];
let cart = JSON.parse(localStorage.getItem('vivero_cart')) || []; 
const ADMIN_EMAIL = "root@vivero.com"; 

const catalog = document.getElementById('catalog');
const adminPanel = document.getElementById('adminPanel');
const authModal = document.getElementById('authModal');
const settingsModal = document.getElementById('settingsModal');
const cartModal = document.getElementById('cartModal');
const editProductModal = document.getElementById('editProductModal');
const reviewsModal = document.getElementById('reviewsModal');
const receiptModal = document.getElementById('receiptModal');

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

// --- CATÁLOGO Y RENDERIZADO ---
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
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

    products.forEach(p => {
        const discountPercentage = calculateDiscount(p.oldPrice, p.newPrice);
        let avgRating = 0;
        const reviews = p.reviews || [];
        if (reviews.length > 0) avgRating = reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length;

        const card = document.createElement('div');
        card.className = 'product-card';
        
        const btnEstado = p.stock > 0 
            ? `<button class="action-btn" onclick="addToCart('${p.id}')">Añadir al carrito</button>` 
            : `<button class="action-btn" disabled style="background:gray;">Agotado</button>`;

        const adminButtons = isAdmin ? `
            <div class="admin-controls">
                <button class="btn-edit" onclick="openEditModal('${p.id}')">✏️ Editar</button>
                <button class="btn-delete" onclick="deleteProduct('${p.id}')">🗑️ Borrar</button>
            </div>
        ` : '';

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
            ${adminButtons}
        `;
        catalog.appendChild(card);
    });
}

function listenToProducts() {
    onSnapshot(collection(db, "plantas"), (snapshot) => {
        products = [];
        snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        renderProducts();
        updateCartUI(); 
    });
}

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('userProfileBadge').classList.remove('hidden');
        document.getElementById('userNameDisplay').textContent = user.displayName || "Sin Nombre";
        document.getElementById('userAvatarBtn').src = user.photoURL || "https://u.cubeupload.com/LAUIS46/defaultimage.png";
        
        // Cargar Dirección Guardada
        const savedAddress = localStorage.getItem('address_' + user.uid) || "";
        document.getElementById('editAddress').value = savedAddress;

        document.getElementById('editProfileArea').classList.remove('hidden');
        document.getElementById('settingsLoginPrompt').classList.add('hidden');
        document.getElementById('addReviewArea').classList.remove('hidden');
        document.getElementById('reviewLoginPrompt').classList.add('hidden');
        adminPanel.classList.toggle('hidden', user.email !== ADMIN_EMAIL);
    } else {
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('userProfileBadge').classList.add('hidden');
        adminPanel.classList.add('hidden');
        document.getElementById('editProfileArea').classList.add('hidden');
        document.getElementById('settingsLoginPrompt').classList.remove('hidden');
        document.getElementById('addReviewArea').classList.add('hidden');
        document.getElementById('reviewLoginPrompt').classList.remove('hidden');
    }
    renderProducts(); 
});

document.getElementById('loginBtn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('cartBtn').addEventListener('click', () => cartModal.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));
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
        await updateProfile(auth.currentUser, { 
            displayName: document.getElementById('editNickname').value || auth.currentUser.displayName, 
            photoURL: document.getElementById('editAvatarUrl').value || auth.currentUser.photoURL 
        });
        
        // Guardar Dirección
        localStorage.setItem('address_' + auth.currentUser.uid, document.getElementById('editAddress').value);
        
        window.location.reload();
    } catch (error) { alert('Error al actualizar'); }
});


// --- SISTEMA DEL CARRITO ---
window.addToCart = function(id) {
    if (!auth.currentUser) return alert("Debes iniciar sesión para comprar."), authModal.classList.remove('hidden');

    const product = products.find(p => p.id === id);
    if (product) {
        const existingItem = cart.find(item => item.id === id);
        
        if (existingItem) {
            if(existingItem.qty < product.stock) {
                existingItem.qty += 1;
                alert(`Cantidad aumentada. Tienes ${existingItem.qty} en el carrito.`);
            } else {
                alert(`Stock máximo alcanzado (${product.stock}).`);
            }
        } else {
            cart.push({ ...product, qty: 1 });
            alert(`${product.name} añadido a tu carrito 🌿`);
        }
        
        localStorage.setItem('vivero_cart', JSON.stringify(cart));
        updateCartUI();
    }
};

window.removeFromCart = function(id) {
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('vivero_cart', JSON.stringify(cart));
    updateCartUI();
};

window.changeCartQty = function(id, newQty) {
    const item = cart.find(i => i.id === id);
    const product = products.find(p => p.id === id);
    
    if (item && product) {
        let parsedQty = parseInt(newQty);
        if (parsedQty > product.stock) parsedQty = product.stock;
        if (parsedQty < 1) parsedQty = 1;
        
        item.qty = parsedQty;
        localStorage.setItem('vivero_cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function updateCartUI() {
    // Corregir items antiguos del carrito (por si no tenían 'qty')
    cart.forEach(item => { if (!item.qty) item.qty = 1; });

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cartCount').textContent = totalItems;
    
    const container = document.getElementById('cartItemsContainer');
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-muted">Tu carrito está vacío.</p>';
    } else {
        container.innerHTML = '';
        cart.forEach((item) => {
            const realProduct = products.find(p => p.id === item.id);
            const stockLimit = realProduct ? realProduct.stock : item.stock;
            
            const price = item.newPrice || item.oldPrice;
            const subtotal = price * item.qty;
            total += subtotal;

            container.innerHTML += `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-details">
                        <strong>${item.name}</strong><br>
                        $${price} c/u
                    </div>
                    <div class="cart-item-actions">
                        <input type="number" class="cart-qty-input" value="${item.qty}" min="1" max="${stockLimit}" onchange="changeCartQty('${item.id}', this.value)">
                        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">X</button>
                    </div>
                </div>
            `;
        });
    }
    document.getElementById('cartTotal').textContent = total.toFixed(2);
}

// --- PASARELA DE PAGO Y TICKET ---
const radioMethods = document.querySelectorAll('input[name="payMethod"]');
const cardDetails = document.getElementById('cardDetails');
const cardNumberInput = document.getElementById('cardNumber');
const cardTypeLabel = document.getElementById('cardTypeLabel');

radioMethods.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if(e.target.value === 'card') {
            cardDetails.classList.remove('hidden');
        } else {
            cardDetails.classList.add('hidden');
        }
    });
});

cardNumberInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.startsWith('4')) {
        cardTypeLabel.textContent = "💳 Visa";
        cardTypeLabel.style.color = "#1a1f71";
    } else if (val.startsWith('5')) {
        cardTypeLabel.textContent = "💳 Mastercard";
        cardTypeLabel.style.color = "#eb001b";
    } else {
        cardTypeLabel.textContent = "💳 Tarjeta";
        cardTypeLabel.style.color = "var(--primary)";
    }
});

document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if(cart.length === 0) return alert("Tu carrito está vacío.");
    
    // Validar Dirección
    const userAddress = localStorage.getItem('address_' + auth.currentUser.uid);
    if(!userAddress || userAddress.trim() === '') {
        alert("Por favor, configura tu dirección de envío en los ⚙️ Ajustes antes de realizar la compra.");
        cartModal.classList.add('hidden');
        settingsModal.classList.remove('hidden');
        return;
    }

    // Validar Tarjeta
    const isCard = document.querySelector('input[name="payMethod"]:checked').value === 'card';
    if(isCard) {
        if(cardNumberInput.value.length < 13 || !document.getElementById('cardExpiry').value || !document.getElementById('cardCVC').value) {
            return alert("Por favor completa los datos de la tarjeta correctamente.");
        }
    }
    
    const btn = document.getElementById('checkoutBtn');
    btn.textContent = "Procesando..."; btn.disabled = true;

    try {
        // Restar Stock
        for (let item of cart) {
            const productRef = doc(db, "plantas", item.id);
            const pDoc = await getDoc(productRef);
            
            if(pDoc.exists()) {
                let currentStock = pDoc.data().stock;
                let newStock = currentStock - item.qty;
                if(newStock < 0) newStock = 0;
                await updateDoc(productRef, { stock: newStock });
            }
        }

        // Generar Datos del Ticket
        document.getElementById('receiptDate').textContent = new Date().toLocaleString('es-MX');
        document.getElementById('receiptName').textContent = auth.currentUser.displayName || "Cliente";
        document.getElementById('receiptAddress').textContent = userAddress;

        const receiptItemsContainer = document.getElementById('receiptItems');
        receiptItemsContainer.innerHTML = '';
        let rTotal = 0;

        cart.forEach(item => {
            const price = item.newPrice || item.oldPrice;
            const subtotal = price * item.qty;
            rTotal += subtotal;
            
            receiptItemsContainer.innerHTML += `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 6px 0;">
                    <span>${item.qty}x ${item.name}</span>
                    <strong>$${subtotal.toFixed(2)}</strong>
                </div>
            `;
        });
        document.getElementById('receiptTotal').textContent = rTotal.toFixed(2);

        // Limpiar Carrito y Mostrar Ticket
        cart = []; 
        localStorage.removeItem('vivero_cart'); 
        updateCartUI();
        
        cartModal.classList.add('hidden');
        receiptModal.classList.remove('hidden');

        cardNumberInput.value = '';
        document.getElementById('cardExpiry').value = '';
        document.getElementById('cardCVC').value = '';
        cardTypeLabel.textContent = "💳 Tarjeta";

    } catch (error) {
        alert("Ocurrió un error al procesar el pago.");
        console.error(error);
    } finally {
        btn.textContent = "Pagar Ahora"; btn.disabled = false;
    }
});

// --- FUNCIONES DE ADMINISTRADOR (CRUD) ---
window.deleteProduct = async function(id) {
    if(confirm("¿Estás seguro de que deseas borrar este producto permanentemente?")) {
        try {
            await deleteDoc(doc(db, "plantas", id));
            alert("Producto eliminado.");
        } catch (error) {
            alert("Error al borrar el producto.");
        }
    }
};

window.openEditModal = function(id) {
    const p = products.find(prod => prod.id === id);
    if(p) {
        document.getElementById('editProdId').value = p.id;
        document.getElementById('editProdName').value = p.name;
        document.getElementById('editProdOldPrice').value = p.oldPrice;
        document.getElementById('editProdNewPrice').value = p.newPrice || '';
        document.getElementById('editProdStock').value = p.stock;
        document.getElementById('editProdDesc').value = p.description;
        document.getElementById('editProdImage').value = p.image;
        editProductModal.classList.remove('hidden');
    }
};

document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = "Actualizando..."; btn.disabled = true;

    try {
        const id = document.getElementById('editProdId').value;
        const productRef = doc(db, "plantas", id);
        
        await updateDoc(productRef, {
            name: document.getElementById('editProdName').value,
            description: document.getElementById('editProdDesc').value,
            oldPrice: parseFloat(document.getElementById('editProdOldPrice').value),
            newPrice: parseFloat(document.getElementById('editProdNewPrice').value) || null,
            image: document.getElementById('editProdImage').value,
            stock: parseInt(document.getElementById('editProdStock').value)
        });

        alert("Producto actualizado exitosamente.");
        editProductModal.classList.add('hidden');
    } catch (error) {
        alert("Error al actualizar el producto.");
    } finally {
        btn.textContent = "Guardar Cambios"; btn.disabled = false;
    }
});

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
            reviews: [],
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
    } finally {
        btn.textContent = "Publicar Reseña"; btn.disabled = false;
    }
});

listenToProducts();
