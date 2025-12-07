    
    /* ------------------ (1) Firebase Imports ------------------ */
    // Leaderboard (RTDB) के लिए imports
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
    
    // Registration (Firestore) के लिए imports
    import { getFirestore, collection, addDoc, getCountFromServer, 
        // ✅ ये 4 फंक्शन्स Registrant Gallery को डेटा खींचने के लिए आवश्यक हैं
    query,    
    orderBy, 
    limit, 
    getDocs 
    } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


    /* ------------------ (2) Firebase Configs ------------------ */

    // A. LEADERBOARD Config (nd-winner-database - RTDB)
    const leaderboardConfig = {
        apiKey: "AIzaSyCqGXOfGXlax6ICPzqGiHoBTnEe8NokJOY", 
        authDomain: "nd-winner-database.firebaseapp.com",
        databaseURL: "https://nd-winner-database-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "nd-winner-database",
        storageBucket: "nd-winner-database.firebasestorage.app",
        messagingSenderId: "441469197064",
        appId: "1:441469197064:web:153dd420fda4e381fe2abd",
        measurementId: "G-22W3YNYYVE"
    };
    
    // B. REGISTRATION Config (registraion-6fb07 - Firestore)
    const registrationConfig = {
        apiKey: "AIzaSyBcu94FakbkgcezDEDPkFBCXKbVbgsa-Og", 
        authDomain: "registraion-6fb07.firebaseapp.com",
        projectId: "registraion-6fb07",
        // यदि इस प्रोजेक्ट में अन्य डिटेल हैं तो जोड़ दें
    };


    // Apps Initialize करें (दो अलग-अलग नाम के साथ)
    const leaderboardApp = initializeApp(leaderboardConfig, "leaderboardApp");
    const registrationApp = initializeApp(registrationConfig, "registrationApp");

    const rtdb = getDatabase(leaderboardApp); // Realtime DB (लीडरबोर्ड)
    const firestoreDb = getFirestore(registrationApp); // Firestore DB (रजिस्ट्रेशन)

    /* ------------------ (3) HTML Elements (Unified) ------------------ */
    const matchSelect = document.getElementById("matchSelect");
    const sortSelect  = document.getElementById("sortCriteria");
    const tableBody   = document.getElementById("leaderboard-body");
    
    const regForm = document.getElementById("final-registration-form"); 
    const regFeedback = document.getElementById("reg-feedback");      
    const copyUpiBtn = document.getElementById("copy-upi-btn");
    const registrationCard = document.querySelector("#registration .card");

    let currentMatchData = [];
    const PRIZE = ["₹25,000/-", "₹15,000/-", "₹10,000/-"];
    const REGISTRATION_LIMIT = 48; 


    // =========================================================================
    //                              (A) LEADERBOARD FUNCTIONS (RTDB)
    // =========================================================================
    
    function renderWinners(data) { 
        // आपके विनर कार्ड रेंडर करने का लॉजिक यहाँ आएगा
        // ...
    }

    function renderTable() { 
        let sorted = [...currentMatchData];
        const sortBy = sortSelect ? sortSelect.value : 'score';
        sorted.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
        
        if (tableBody) tableBody.innerHTML = "";
        
        if (sorted.length === 0 && tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">कोई टीम डेटा उपलब्ध नहीं है।</td></tr>';
            return;
        }

        let rowsHTML = '';
        sorted.forEach((t, i) => {
            const score = t.score !== undefined && t.score !== null ? t.score : '-';
            const kills = t.kills !== undefined && t.kills !== null ? t.kills : '-';
            const placement = t.placement !== undefined && t.placement !== null ? t.placement : '-';
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
            rowsHTML += `
                <tr class="${rankClass}">
                    <td>${i + 1}</td>
                    <td>${t.name || 'Unknown Team'}</td>
                    <td style="font-weight:bold;">${score}</td>
                    <td>${kills}</td>
                    <td>${placement}</td>
                </tr>
            `;
        });
        
        if (tableBody) tableBody.innerHTML = rowsHTML;
        if (matchSelect && matchSelect.value === "final") {
            renderWinners(sorted);
        }
    }

    function loadMatch(matchKey) { 
        const dbRef = ref(rtdb, `leaderboard/${matchKey}`); 
        onValue(dbRef, (snapshot) => {
            const data = snapshot.val();
            currentMatchData = data ? Object.values(data) : []; 
            renderTable();
        });
    }

    function loadFinalLeaderboard() { 
        const dbRef = ref(rtdb, "leaderboard"); 
        onValue(dbRef, (snapshot) => {
            const fullData = snapshot.val() || {};
            const final = {};
            for (const matchKey in fullData) {
                const matchData = fullData[matchKey];
                for (const teamKey in matchData) {
                    const t = matchData[teamKey];
                    if (!final[teamKey]) {
                        final[teamKey] = {
                            name: t.name || teamKey, 
                            score: 0, 
                            kills: 0, 
                            placement: 0,
                            img_url: t.img_url || null
                        };
                    }
                    final[teamKey].score += (t.score || 0);
                    final[teamKey].kills += (t.kills || 0);
                    final[teamKey].placement += (t.placement || 0);
                    if (t.img_url) {
                        final[teamKey].img_url = t.img_url;
                    }
                }
            }
            currentMatchData = Object.values(final);
            renderTable();
        });
    }

    if (matchSelect) matchSelect.addEventListener("change", () => {
        if (matchSelect.value === "final") loadFinalLeaderboard();
        else loadMatch(matchSelect.value);
    });

    if (sortSelect) sortSelect.addEventListener("change", renderTable);
    loadFinalLeaderboard();


    // =========================================================================
    //                              (B) REGISTRATION LOGIC (FIRESTORE)
    // =========================================================================

    // --- 1. Registration Limit Check (Firestore Count) ---
    async function checkRegistrationLimit() {
        const registrationsCol = collection(firestoreDb, 'registrations'); 
        
        try {
            const snapshot = await getCountFromServer(registrationsCol);
            const currentCount = snapshot.data().count;
            
            const countDisplayEl = document.getElementById('reg-count-display'); 
            if(countDisplayEl) {
                countDisplayEl.textContent = `सीटें भरीं: ${currentCount}/${REGISTRATION_LIMIT}`;
            }
            
            if (currentCount >= REGISTRATION_LIMIT) {
                if (regForm) regForm.style.display = 'none';
                if (registrationCard) {
                     registrationCard.innerHTML = `
                        <h3 style="color: red; font-size: 1.5em; margin-top: 20px;">🚫 Registration is full!</h3>
                        <p style="color: var(--text-light);">All ${REGISTRATION_LIMIT} Seats are full. Thank you!</p>
                     `;
                }
            }
        } catch(error) {
            console.error("Error fetching registration count:", error);
        }
    }
    checkRegistrationLimit();
    setInterval(checkRegistrationLimit, 30000); 


    // --- 2. UPI Copy Listener ---
    if (copyUpiBtn) {
        copyUpiBtn.addEventListener("click", () => {
            const upiId = document.getElementById("upi-id-copy").innerText.trim();
            navigator.clipboard.writeText(upiId).then(() => {
                alert("UPI ID copied successfully!");
            });
        });
    }

    // --- 3. Form Submission Listener (Firestore Save) ---
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if(regFeedback) regFeedback.innerHTML = "<span style='color:var(--accent-color);'><i class='fas fa-spinner fa-spin'></i> प्रोसेसिंग...</span>";
            
            const playerName = document.getElementById("player-name").value.trim(); 
            const ign = document.getElementById("ign").value.trim();
            const ffuid = document.getElementById("ffuid").value.trim();
            const device = document.getElementById("device").value.trim();
            const playerEmail = document.getElementById("player-email").value.trim(); 
            const playerWhatsapp = document.getElementById("player-whatsapp").value.trim();
            const transactionId = document.getElementById("transaction-id").value.trim();
            
            if (device === "") { 
                if(regFeedback) regFeedback.innerHTML = "<span style='color:red;'>❌ कृपया डिवाइस चुनें।</span>";
                return; 
            }
            if (transactionId.length < 8) { 
                if(regFeedback) regFeedback.innerHTML = "<span style='color:red;'>❌ Transaction ID कम से कम 8 अंक की होनी चाहिए।</span>";
                return; 
            }

            try {
                await addDoc(collection(firestoreDb, "registrations"), {
                    playerName: playerName,
                    ign: ign,
                    ffuid: ffuid,
                    device: device,
                    playerEmail: playerEmail,
                    playerWhatsapp: playerWhatsapp,
                    transactionId: transactionId,
                    registrationTime: new Date().toISOString(),
                    paymentStatus: 'Awaiting Verification' 
                });

                // 🟢 सफलता का मैसेज और UI अपडेट
                regForm.style.display = 'none'; 
                const successMessageHTML = `
                    <h3 style="color: var(--highlight-color); font-size: 1.5em; margin-top: 10px;">🎊 Registration Successful!</h3>
                    <p style="color: var(--text-light); font-size: 1.1em;">
                        You **${playerName}**  have successfully registered as [Role/Team Name]. Your Transaction ID is **${transactionId}** The verification process is underway.
                    </p>
                    <div class="reg-step" style="border-left:4px solid var(--highlight-color); margin-top:30px; background-color: #2D3748; padding: 20px; border-radius: 8px;">
                        <i class="fab fa-whatsapp" style="color: #25D366; font-size: 2em; float: left; margin-right: 15px;"></i>
                        <div>
                            <h3 style="color: var(--text-light); margin-top:0;">WhatsApp ग्रुप जॉइन करें</h3>
                            <p style="color: #90A4AE; margin-bottom: 15px;">Get all Room IDs, Passwords, and important updates here instantly.</p>
                            <a href="https://chat.whatsapp.com/Gxve7efJHo2F95MDlzTyGG?mode=wwt" target="_blank" class="cta-button" 
                                style="background-color:#25D366; border-color:#25D366; color:#fff; padding: 10px 25px;">
                                💬 Join the WhatsApp Group
                            </a>
                        </div>
                    </div>
                `;
                
                if (registrationCard) registrationCard.innerHTML = successMessageHTML;
                document.getElementById('registration').scrollIntoView({ behavior: 'smooth' });
                checkRegistrationLimit(); 

            } catch (error) {
                console.error("Firestore Registration Error:", error);
                if(regFeedback) regFeedback.innerHTML = "<span style='color:red;'>❌ रजिस्ट्रेशन में गंभीर त्रुटि आई। (Firestore Rules जाँचें!)</span>";
            }
        });
    }

    // =========================================================================
    //                              (C) UTILITY FUNCTIONS 🚀
    // =========================================================================

    // --- 1. Slider Functionality ---
    let slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    if (slides.length > 0) {
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 5000); // 5 सेकंड में स्लाइड बदलेगी
    }

    // --- 2. Countdown Timer ---
    const countdown = document.getElementById("countdown");
    const ctaButton = document.querySelector('.cta-button'); 

    function getISTTime() {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const istOffset = 330 * 60000; 
        return new Date(utc + istOffset);
    }

    function updateCountdown() {
        // नोट: इन तारीखों को अपने इवेंट की तारीखों से बदल लें
        const startDate = new Date("2025-11-23T12:35:00+05:30").getTime(); // रजिस्ट्रेशन शुरू
        const endDate = new Date("2025-12-15T23:59:59+05:30").getTime(); // रजिस्ट्रेशन बंद 
        const now = getISTTime().getTime();

        if (now < startDate) {
            const diff = startDate - now;
            const hrsLeft = Math.floor(diff / (1000 * 60 * 60));
            const minsLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if(countdown) countdown.innerHTML = `⏳ Registration <strong>November 23th at 12 PM</strong> will start from (approximately <strong>${String(hrsLeft).padStart(2,'0')}</strong> Hours <strong>${String(minsLeft).padStart(2,'0')}</strong> minuets)`;
            
            if (ctaButton) {
                ctaButton.textContent = "🛡️ Starts on November 23th at 12 PM.";
                ctaButton.style.backgroundColor = "#555";
                ctaButton.style.borderColor = "#555";
                ctaButton.style.pointerEvents = "none";
            }
            return;
        }

        if (now > endDate) {
            if(countdown) countdown.innerHTML = "🚫 Registration is closed";
            
            if (ctaButton) {
                ctaButton.textContent = "🚫 Registration Closed";
                ctaButton.removeAttribute("href");
                ctaButton.style.backgroundColor = "#990000";
                ctaButton.style.borderColor = "#FF4444";
                ctaButton.style.pointerEvents = "none";
            }
            return;
        }

        const distance = endDate - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        if(countdown) countdown.innerHTML =
            `Registration closes in: <strong>${String(days).padStart(2,'0')}</strong> Days <strong>${String(hours).padStart(2,'0')}</strong> Hours <strong>${String(minutes).padStart(2,'0')}</strong> Minutes`;

        if (ctaButton) {
            ctaButton.textContent = "🛡️ Register now!";
            ctaButton.setAttribute("href", "#registration");
            ctaButton.style.backgroundColor = "var(--accent-color)";
            ctaButton.style.borderColor = "var(--highlight-color)";
            ctaButton.style.pointerEvents = "auto";
        }
    }

    updateCountdown();
    setInterval(updateCountdown, 60000); // हर 1 मिनट में अपडेट करें

    // --- 3. Hamburger Menu Toggle ---
    window.toggleMenu = function() {
        document.querySelector('nav div:not(.nav-hamburger)').classList.toggle('active');
    }

    // --- 4. Section Heights (Optional Utility) ---
    function matchSectionHeights() {
        const sections = document.querySelectorAll('.two-column-section');
        sections.forEach(sec => {
            const divs = sec.querySelectorAll('> div');
            let maxHeight = 0;
            divs.forEach(d => maxHeight = Math.max(maxHeight, d.offsetHeight));
            // यहाँ आप max-height को सेट कर सकते हैं यदि CSS में यह ज़रूरी हो
        });
    }
    window.addEventListener('load', matchSectionHeights);
    window.addEventListener('resize', matchSectionHeights);
    

    /* =========================================================================
   (D) REGISTRANT GALLERY LOGIC (FIRESTORE)
   ========================================================================= */

// --- 1. रैंडम FF अवतारों की गैलरी ---
// 🚨 IMPORTANT: नीचे दिए गए लिंक्स को बदलकर अपने द्वारा अपलोड किए गए 8-10 अलग-अलग FF अवतार इमेजेस के स्थायी URLs डालें।
const FF_AVATAR_GALLERY = [
    // FF Avatar Placeholder URLs (Replace these!)
    'https://i.pinimg.com/736x/7e/70/a5/7e70a5c208b90673652764dcdc26edcf.jpg', 
    'https://i.pinimg.com/736x/06/44/13/06441317664c4d32ee9b1441772f023e.jpg', 
    'https://i.pinimg.com/1200x/ed/76/49/ed7649b453bb9dc63b95f5f299ae1525.jpg', 
    'https://i.pinimg.com/736x/4c/d7/af/4cd7af06816f608a9e988059b4b837d2.jpg', 
    'https://i.pinimg.com/1200x/91/f6/25/91f6252a762572edf17efe96c016ec45.jpg', 
    'https://i.pinimg.com/736x/ff/ef/0a/ffef0aaf02ee5591e8354bd98abc80ae.jpg', 
    'https://i.pinimg.com/1200x/ba/ab/63/baab63ed10e3e38931ec4dae4d7248a4.jpg', 
    'https://i.pinimg.com/736x/c5/17/60/c517600ecc31a2dbe46199b8ec9c1fff.jpg',
    'https://i.pinimg.com/736x/53/3b/95/533b95fcbd821f8f60eb70d681ac68cb.jpg',
    'https://i.pinimg.com/736x/55/ba/03/55ba03833c583a775d8dcd82875ec607.jpg',
    'https://i.pinimg.com/736x/3b/7e/0d/3b7e0d7ed46f87888eb5ace2329fd223.jpg',
    'https://i.pinimg.com/736x/6a/1b/26/6a1b2678fcc453c2358a87bfcd3e19e7.jpg',
    'https://i.pinimg.com/1200x/16/08/82/160882dc9346bd7e949764b5c8004717.jpg',
    'https://i.pinimg.com/1200x/8d/60/74/8d607471bf31fbd6c0837bd56e61188c.jpg',
    'https://i.pinimg.com/736x/8b/7a/25/8b7a25fb04ea84f791b54f27ec899f46.jpg',
    'https://i.pinimg.com/736x/cd/37/9f/cd379fe157b381dfb926d2fb83a610e9.jpg',
    'https://i.pinimg.com/736x/38/4e/90/384e908c009cc673b6fecdc8c7b07bab.jpg',
    // आप इसमें और भी अवतार जोड़ सकते हैं ताकि विविधता बनी रहे।
];

// यह फ़ंक्शन किसी भी स्ट्रिंग (IGN) को एक नंबर में बदलता है
function stringToStableHash(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash); // केवल पॉजिटिव नंबर रिटर्न करें
}
const playerCarousel = document.getElementById("player-carousel");
const carouselSpeed = 4000; // 3 सेकंड में ऑटो-स्क्रॉल

function renderPlayerCard(player) {
    // 1. खिलाड़ी के IGN का उपयोग करके एक स्थायी नंबर प्राप्त करें
    const stableHash = stringToStableHash(player.ign);
    
    // 2. उस नंबर का उपयोग करके FF_AVATAR_GALLERY Array से एक स्थायी इंडेक्स चुनें
    // (मोड्यूलो ऑपरेटर (%) यह सुनिश्चित करता है कि इंडेक्स Array की सीमा के भीतर रहे)
    const permanentIndex = stableHash % FF_AVATAR_GALLERY.length; 
    
    const stableAvatarUrl = FF_AVATAR_GALLERY[permanentIndex];
    
    // यदि डेटाबेस में 'photoUrl' है तो उसे लें, अन्यथा स्थायी अवतार का उपयोग करें
    const avatarUrl = player.photoUrl || stableAvatarUrl; 

    return `
        <div class="player-card">
            <img src="${avatarUrl}" alt="${player.ign || 'Player'}" class="player-avatar">
            <h4>${player.ign || 'N/A'}</h4>
            <p>Name: ${player.playerName || 'N/A'}</p>
            <p>Device: ${player.device || 'N/A'}</p>
        </div>
    `;
}

async function loadRegistrantsGallery() {
    // ⚠️ सुनिश्चित करें कि आपके Firebase Imports में ये सब शामिल हैं: 
    // query, orderBy, limit, getDocs
    const registrationsCol = collection(firestoreDb, 'registrations'); 
    
    try {
        // Firestore से अंतिम 20 रजिस्ट्रेशन डॉक्यूमेंट लाएँ
        const q = query(registrationsCol, orderBy("registrationTime", "desc"), limit(20));
        const querySnapshot = await getDocs(q); 
        
        let cardsHTML = '';
        if (querySnapshot.empty) {
            cardsHTML = '<div style="text-align: center; color: var(--highlight-color); margin:15px;">कोई हालिया रजिस्ट्रेशन नहीं मिला। जल्दी रजिस्टर करें!</div>';
        } else {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                cardsHTML += renderPlayerCard(data);
            });
        }
        
        if (playerCarousel) {
            playerCarousel.innerHTML = cardsHTML;
            if (!querySnapshot.empty) {
                 startAutoScroll(); // ऑटो-स्क्रॉल शुरू करें
            }
        }

    } catch(error) {
        console.error("Error loading registrants gallery:", error);
        if (playerCarousel) {
            playerCarousel.innerHTML = '<div style="color:red; margin:15px;">खिलाड़ी गैलरी लोड करने में त्रुटि।</div>';
        }
    }
}

// ऑटो-स्क्रॉल और मैनुअल स्क्रॉल फंक्शनैलिटी
let scrollInterval;
function startAutoScroll() {
    if (!playerCarousel || playerCarousel.children.length === 0) return;

    scrollInterval = setInterval(() => {
        // यदि हम अंत तक पहुँच गए हैं, तो वापस शुरू में स्क्रॉल करें
        if (playerCarousel.scrollLeft + playerCarousel.clientWidth >= playerCarousel.scrollWidth) {
            playerCarousel.scrollLeft = 0;
        } else {
            // अगले कार्ड पर स्क्रॉल करें (पहले कार्ड की चौड़ाई और मार्जिन के बराबर)
            const firstCard = playerCarousel.querySelector('.player-card');
            if (firstCard) {
                const cardWidth = firstCard.offsetWidth + 15; // 15px margin-right
                playerCarousel.scrollLeft += cardWidth;
            }
        }
    }, carouselSpeed);
}

// मैनुअल बटन के लिए फंक्शन (index.html में बटन के साथ इस्तेमाल होगा)
window.scrollCarousel = function(direction) {
    if (!playerCarousel || playerCarousel.children.length === 0) return;
    
    clearInterval(scrollInterval); // ऑटो-स्क्रॉल रोकें
    
    const firstCard = playerCarousel.querySelector('.player-card');
    if (firstCard) {
        const cardWidth = firstCard.offsetWidth + 15;
        playerCarousel.scrollLeft += direction * cardWidth;
    }
    
    // 5 सेकंड बाद ऑटो-स्क्रॉल फिर से शुरू करें
    setTimeout(startAutoScroll, 5000); 
}

// पेज लोड होने पर गैलरी लोड करें
// सुनिश्चित करें कि यह फंक्शन DOMContentLoaded के बाद या किसी भी init फंक्शन के अंदर कॉल हो रहा है
loadRegistrantsGallery();