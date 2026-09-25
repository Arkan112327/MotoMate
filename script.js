// ==========================================
        // DATA STATE MANAGEMENT
        // ==========================================
        const defaultMotorcycle = {
            name: "Yamaha Vixion",
            year: 2019,
            mileage: 32480,
            type: "Sport",
            engineCapacity: "150 cc",
            fuelSystem: "Injeksi",
            transmission: "Manual",
            coolingSystem: "Liquid Cooled",
            usage: "Harian"
        };

        const defaultMaintenance = [
            { id: "1", name: "Ganti Oli", icon: "drop", last: 31000, interval: 2000 },
            { id: "2", name: "Rantai", icon: "link", last: 30000, interval: 3000 },
            { id: "3", name: "Ban", icon: "circle-notch", last: 29000, interval: 10000 },
            { id: "4", name: "Rem", icon: "disc", last: 30000, interval: 5000 },
            { id: "5", name: "Busi", icon: "lightning", last: 20000, interval: 10000 },
            { id: "6", name: "Filter Udara", icon: "wind", last: 20000, interval: 10000 }
        ];

        let currentMotorcycle = {};
        let maintenanceRecords = [];
        let isDemoData = false;

        function initData() {
            try {
                const savedMotorData = localStorage.getItem('motomate_motor');
                if (savedMotorData) {
                    const parsed = JSON.parse(savedMotorData);
                    currentMotorcycle = {
                        name: parsed.name || defaultMotorcycle.name,
                        year: parseInt(parsed.year) || defaultMotorcycle.year,
                        mileage: parseInt(parsed.mileage) >= 0 ? parseInt(parsed.mileage) : defaultMotorcycle.mileage,
                        type: parsed.type || defaultMotorcycle.type,
                        engineCapacity: parsed.engineCapacity || parsed.engine || defaultMotorcycle.engineCapacity,
                        fuelSystem: parsed.fuelSystem || parsed.fuel || defaultMotorcycle.fuelSystem,
                        transmission: parsed.transmission || defaultMotorcycle.transmission,
                        coolingSystem: parsed.coolingSystem || (parsed.isLiquidCooled ? "Liquid Cooled" : defaultMotorcycle.coolingSystem),
                        usage: parsed.usage || defaultMotorcycle.usage
                    };
                } else {
                    currentMotorcycle = { ...defaultMotorcycle };
                    isDemoData = true;
                }

                const savedMaintData = localStorage.getItem('motomate_maint');
                if (savedMaintData) {
                    maintenanceRecords = JSON.parse(savedMaintData);
                    if (!Array.isArray(maintenanceRecords)) throw new Error('Invalid maintenance data');
                    maintenanceRecords = maintenanceRecords.filter(r => r && r.name).map(r => ({...r, last:Number(r.last)||0, interval:Math.max(1,Number(r.interval)||1), cost:Number(r.cost)||0}));
                    isDemoData = false;
                } else {
                    maintenanceRecords = JSON.parse(JSON.stringify(defaultMaintenance));
                    if(currentMotorcycle.coolingSystem === "Liquid Cooled") {
                        maintenanceRecords.push({ id: "7", name: "Coolant", icon: "thermometer", last: 20000, interval: 15000 });
                    }
                }
            } catch (e) {
                console.error("Could not access localStorage", e);
                currentMotorcycle = { ...defaultMotorcycle };
                maintenanceRecords = JSON.parse(JSON.stringify(defaultMaintenance));
                isDemoData = true;
            }
            
            const demoNote = document.getElementById('demo-note');
            if(demoNote) demoNote.style.display = isDemoData ? 'block' : 'none';

            updateUI();
        }

        function formatKm(num) {
            return new Intl.NumberFormat('id-ID').format(num);
        }
        
        function getIconForType(name) {
            const map = {
                "Ganti Oli": "drop",
                "Rantai": "link",
                "Ban": "circle-notch",
                "Rem": "disc",
                "Busi": "lightning",
                "Filter Udara": "wind",
                "Coolant": "thermometer"
            };
            return map[name] || "wrench";
        }

        // ==========================================
        // MAINTENANCE CALCULATIONS
        // ==========================================
        function calculateMaintenanceStatus(record, currentMileage) {
            const intervalKm = Math.max(1, Number(record.interval) || 1);
            const nextMaintenance = (Number(record.last) || 0) + intervalKm;
            const remainingKm = nextMaintenance - currentMileage;
            let remainingMonths = null;
            if (record.months && record.lastDate) {
                const due = new Date(record.lastDate + 'T00:00:00');
                due.setMonth(due.getMonth() + Number(record.months));
                remainingMonths = Math.ceil((due - new Date()) / (30.4375 * 86400000));
            }
            const kmDue = remainingKm <= 0;
            const timeDue = remainingMonths !== null && remainingMonths <= 0;
            const kmSoon = remainingKm <= 500;
            const timeSoon = remainingMonths !== null && remainingMonths <= 1;
            let status = 'Baik', badgeClass = 'badge-success';
            if (kmDue || timeDue) { status='Terlewat'; badgeClass='badge-danger'; }
            else if (kmSoon || timeSoon) { status='Segera'; badgeClass='badge-danger'; }
            else if (remainingKm <= 1000 || (remainingMonths !== null && remainingMonths <= 2)) { status='Periksa'; badgeClass='badge-warning'; }
            const consumed = currentMileage - (Number(record.last) || 0);
            const progressPercent = Math.min(100, Math.max(0, (consumed / intervalKm) * 100));
            return { next: nextMaintenance, remaining: remainingKm, remainingMonths, status, badgeClass, progressPercent };
        }

        // ==========================================
        // UI RENDERING
        // ==========================================
        function updateUI() {
            const formattedMileage = formatKm(currentMotorcycle.mileage) + " km";
            const bindings = {
                'motor-name': currentMotorcycle.name,
                'motor-year': currentMotorcycle.year,
                'motor-mileage': formattedMileage,
                'motor-type': currentMotorcycle.type,
                'motor-engineCapacity': currentMotorcycle.engineCapacity,
                'motor-fuelSystem': currentMotorcycle.fuelSystem,
                'motor-transmission': currentMotorcycle.transmission,
                'motor-coolingSystem': currentMotorcycle.coolingSystem,
                'motor-usage': currentMotorcycle.usage,
            };

            for (const [key, value] of Object.entries(bindings)) {
                const elements = document.querySelectorAll(`[data-bind="${key}"]`);
                elements.forEach(el => el.textContent = value);
            }

            renderMaintenanceLists();
            updateDashboardStatus();
            updateFuelEstimate();
        }

        function renderMaintenanceLists() {
            const mainList = document.getElementById('main-maintenance-list');
            const berandaList = document.getElementById('beranda-maintenance-list');
            
            if(!mainList || !berandaList) return;

            mainList.innerHTML = '';
            berandaList.innerHTML = '';

            const processedRecords = maintenanceRecords.map(record => {
                const calc = calculateMaintenanceStatus(record, currentMotorcycle.mileage);
                return { ...record, ...calc };
            }).sort((a, b) => a.remaining - b.remaining);

            processedRecords.forEach(record => {
                const isOverdue = record.remaining < 0;
                const remainingText = isOverdue ? `${formatKm(Math.abs(record.remaining))} km lewat` : `${formatKm(record.remaining)} km`;
                const progressColor = record.status === 'Terlewat' || record.status === 'Segera' ? 'var(--status-danger)' : 
                                      record.status === 'Periksa' ? 'var(--status-warning)' : 'var(--accent-primary)';

                const itemHTML = `
                    <div class="maint-item">
                        <div class="maint-item-header">
                            <div class="maint-info-left">
                                <div class="maint-icon-wrap"><i class="ph ph-${record.icon}"></i></div>
                                <div class="maint-info">
                                    <span class="maint-name">
                                        ${record.name}
                                        <span class="badge ${record.badgeClass}">${record.status}</span>
                                    </span>
                                </div>
                            </div>
                            <div class="maint-actions"><button class="icon-btn" onclick="markMaintenanceDone('${record.id}')" aria-label="Sudah dilakukan" title="Sudah dilakukan"><i class="ph ph-check"></i></button><button class="icon-btn" onclick="openEditMaintenanceModal('${record.id}')" aria-label="Edit" title="Edit"><i class="ph ph-pencil-simple"></i></button></div>
                        </div>
                        
                        <div class="maint-details-grid">
                            <div class="maint-detail-col">
                                <span class="maint-detail-label">Terakhir</span>
                                <span class="maint-detail-value">${formatKm(record.last)}</span>
                            </div>
                            <div class="maint-detail-col" style="text-align: center;">
                                <span class="maint-detail-label">Sisa</span>
                                <span class="maint-detail-value" style="color: ${progressColor}">${remainingText}</span>
                            </div>
                            <div class="maint-detail-col" style="text-align: right;">
                                <span class="maint-detail-label">Berikutnya</span>
                                <span class="maint-detail-value">${formatKm(record.next)}</span>
                            </div>
                        </div>
                        
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${record.progressPercent}%; background-color: ${progressColor}"></div>
                        </div>
                        <div class="maint-meta">${record.months ? `Setiap ${record.months} bulan` : ''}${record.cost ? ` · Est. ${formatRupiah(record.cost)}` : ''}${record.remainingMonths !== null ? ` · ${record.remainingMonths <= 0 ? 'jatuh tempo waktu' : record.remainingMonths + ' bln tersisa'}` : ''}</div>
                    </div>
                `;
                mainList.insertAdjacentHTML('beforeend', itemHTML);
            });

            const topRecords = processedRecords.slice(0, 2);
            if(topRecords.length === 0) {
                berandaList.innerHTML = '<p class="maint-desc">Belum ada data perawatan.</p>';
                return;
            }

            topRecords.forEach(record => {
                const isOverdue = record.remaining < 0;
                const remainingText = isOverdue ? `${formatKm(Math.abs(record.remaining))} km` : `${formatKm(record.remaining)} km lagi`;
                
                const itemHTML = `
                    <div class="maint-item beranda-maint-item" style="padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);">
                        <div class="maint-info-left">
                            <div class="maint-icon-wrap"><i class="ph ph-${record.icon}"></i></div>
                            <div class="maint-info">
                                <span class="maint-name">${record.name}</span>
                                <span class="maint-desc">
                                    <span style="color: ${record.badgeClass === 'badge-success' ? 'inherit' : 'var(--status-' + record.badgeClass.split('-')[1] + ')'}; font-weight: 500;">
                                        ${record.status}
                                    </span> · ${remainingText}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
                berandaList.insertAdjacentHTML('beforeend', itemHTML);
            });
            
            const lastBerandaItem = berandaList.lastElementChild;
            if(lastBerandaItem) {
                lastBerandaItem.style.borderBottom = 'none';
                lastBerandaItem.style.paddingBottom = '0';
            }
        }

        // ==========================================
        // NAVIGATION
        // ==========================================
        function navigateTo(viewId) {
            document.querySelectorAll('.view').forEach(view => {
                view.classList.remove('active');
            });

            const targetView = document.getElementById(`view-${viewId}`);
            if(targetView) targetView.classList.add('active');

            document.querySelectorAll('.nav-item').forEach(btn => {
                btn.classList.remove('active');
                const icon = btn.querySelector('.nav-icon');
                if(icon) {
                    icon.classList.remove('ph-fill');
                    icon.classList.add('ph');
                }

                if (btn.dataset.target === viewId) {
                    btn.classList.add('active');
                    if(icon) {
                        icon.classList.remove('ph');
                        icon.classList.add('ph-fill');
                    }
                }
            });

            window.scrollTo(0, 0);
        }

        function scrollToFuel() {
            navigateTo('beranda');
            setTimeout(() => {
                const fuelSection = document.getElementById('fuel-section');
                if(fuelSection) {
                    fuelSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    fuelSection.style.transition = 'box-shadow 0.3s';
                    fuelSection.style.boxShadow = 'var(--shadow-glow)';
                    setTimeout(() => { fuelSection.style.boxShadow = 'none'; }, 1000);
                }
            }, 50);
        }

        // ==========================================
        // MODALS & FORMS
        // ==========================================
        function showToast(message) {
            const toast = document.getElementById('toast');
            const toastMsg = document.getElementById('toastMessage');
            
            toastMsg.textContent = message;
            toast.classList.add('show');
            
            setTimeout(() => { toast.classList.remove('show'); }, 3000);
        }

        function openModal(modalId) {
            document.getElementById(modalId).classList.add('show');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }
        
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) backdrop.classList.remove('show');
            });
        });

        // Motor Edit
        function openEditModal() {
            document.querySelectorAll('#editMotorForm .form-group').forEach(el => el.classList.remove('has-error'));
            
            document.getElementById('edit-name').value = currentMotorcycle.name;
            document.getElementById('edit-year').value = currentMotorcycle.year;
            document.getElementById('edit-mileage').value = currentMotorcycle.mileage;
            document.getElementById('edit-type').value = currentMotorcycle.type;
            document.getElementById('edit-engine').value = currentMotorcycle.engineCapacity;
            document.getElementById('edit-fuel').value = currentMotorcycle.fuelSystem;
            document.getElementById('edit-transmission').value = currentMotorcycle.transmission;
            document.getElementById('edit-cooling').value = currentMotorcycle.coolingSystem;
            document.getElementById('edit-usage').value = currentMotorcycle.usage;
            
            openModal('editModal');
        }

        function setInputError(inputId, message) {
            const input = document.getElementById(inputId);
            const group = input.closest('.form-group') || input.parentElement;
            group.classList.add('has-error');
            const errorSpan = group.querySelector('.form-error');
            if (errorSpan) errorSpan.textContent = message;
        }

        function saveMotorData(event) {
            event.preventDefault();
            
            document.querySelectorAll('#editMotorForm .form-group').forEach(el => el.classList.remove('has-error'));
            document.querySelectorAll('#editMotorForm > div > div').forEach(el => el.classList.remove('has-error'));
            
            let isValid = true;
            
            const name = document.getElementById('edit-name').value.trim();
            const year = parseInt(document.getElementById('edit-year').value, 10);
            const mileage = parseInt(document.getElementById('edit-mileage').value, 10);
            const type = document.getElementById('edit-type').value;
            const engineCapacity = document.getElementById('edit-engine').value.trim();
            const fuelSystem = document.getElementById('edit-fuel').value;
            const transmission = document.getElementById('edit-transmission').value;
            const coolingSystem = document.getElementById('edit-cooling').value;
            const usage = document.getElementById('edit-usage').value;

            if (!name) { setInputError('edit-name', 'Wajib diisi'); isValid = false; }
            if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) { setInputError('edit-year', 'Tahun tidak valid'); isValid = false; }
            if (isNaN(mileage) || mileage < 0) { setInputError('edit-mileage', 'Kilometer tidak valid'); isValid = false; }
            if (!type) { setInputError('edit-type', 'Wajib dipilih'); isValid = false; }
            if (!fuelSystem) { setInputError('edit-fuel', 'Wajib dipilih'); isValid = false; }

            if (!isValid) return;

            currentMotorcycle = {
                name, year, mileage, type, engineCapacity, fuelSystem, transmission, coolingSystem, usage
            };
            
            if (coolingSystem === "Air Cooled") {
                maintenanceRecords = maintenanceRecords.filter(record => record.name !== "Coolant");
            } else if (coolingSystem === "Liquid Cooled") {
                const hasCoolant = maintenanceRecords.some(record => record.name === "Coolant");
                if (!hasCoolant) {
                    maintenanceRecords.push({
                        id: Date.now().toString(),
                        name: "Coolant",
                        icon: "thermometer",
                        last: mileage,
                        interval: 15000
                    });
                }
            }
            
            try { 
                localStorage.setItem('motomate_motor', JSON.stringify(currentMotorcycle)); 
                localStorage.setItem('motomate_maint', JSON.stringify(maintenanceRecords));
            } catch(e){}
            
            updateUI();
            closeModal('editModal');
            showToast("Data motor berhasil diperbarui.");
        }

        // Mileage Update
        function openUpdateMileageModal() {
            document.getElementById('update-mileage-input').value = currentMotorcycle.mileage;
            openModal('updateMileageModal');
        }

        function saveMileageData(event) {
            event.preventDefault();
            const newMileage = parseInt(document.getElementById('update-mileage-input').value, 10);
            if (isNaN(newMileage) || newMileage < 0) { showToast('Kilometer tidak valid.'); return; }
            
            if (newMileage < currentMotorcycle.mileage && !confirm("Kilometer baru lebih rendah dari sebelumnya. Lanjutkan?")) {
                return;
            }

            currentMotorcycle.mileage = newMileage;
            
            try { localStorage.setItem('motomate_motor', JSON.stringify(currentMotorcycle)); } catch(e){}
            
            updateUI();
            closeModal('updateMileageModal');
            showToast("Kilometer berhasil diperbarui.");
        }

        // Maintenance Add/Edit
        function openAddMaintenanceModal() {
            document.getElementById('maint-modal-title').textContent = "Tambah Perawatan";
            document.getElementById('maint-id').value = "";
            document.getElementById('maint-type').value = "Ganti Oli";
            document.getElementById('maint-last').value = currentMotorcycle.mileage;
            document.getElementById('maint-interval').value = 2000;
            document.getElementById('maint-months').value = '';
            document.getElementById('maint-date').value = new Date().toISOString().slice(0,10);
            document.getElementById('maint-cost').value = '';
            
            document.getElementById('maint-type').disabled = false;
            openModal('maintenanceModal');
        }

        function openEditMaintenanceModal(id) {
            const record = maintenanceRecords.find(r => r.id === id);
            if(!record) return;

            document.getElementById('maint-modal-title').textContent = "Edit Perawatan";
            document.getElementById('maint-id').value = record.id;
            document.getElementById('maint-type').value = record.name;
            document.getElementById('maint-last').value = record.last;
            document.getElementById('maint-interval').value = record.interval;
            document.getElementById('maint-months').value = record.months || '';
            document.getElementById('maint-date').value = record.lastDate || '';
            document.getElementById('maint-cost').value = record.cost || '';
            
            openModal('maintenanceModal');
        }

        function saveMaintenance(event) {
            event.preventDefault();
            
            const id = document.getElementById('maint-id').value;
            const type = document.getElementById('maint-type').value;
            const last = parseInt(document.getElementById('maint-last').value, 10);
            const interval = parseInt(document.getElementById('maint-interval').value, 10);
            const monthsRaw = parseInt(document.getElementById('maint-months').value, 10);
            const lastDate = document.getElementById('maint-date').value || '';
            const costRaw = parseInt(document.getElementById('maint-cost').value, 10);
            const months = Number.isFinite(monthsRaw) && monthsRaw > 0 ? monthsRaw : null;
            const cost = Number.isFinite(costRaw) && costRaw >= 0 ? costRaw : 0;
            if (!type || isNaN(last) || last < 0 || isNaN(interval) || interval <= 0) { showToast('Isi data perawatan dengan benar.'); return; }
            
            if (last > currentMotorcycle.mileage) {
                showToast("Kilometer terakhir tidak bisa lebih besar dari kilometer saat ini.");
                return;
            }

            if (id) {
                const index = maintenanceRecords.findIndex(r => r.id === id);
                if(index !== -1) {
                    maintenanceRecords[index].name = type;
                    maintenanceRecords[index].icon = getIconForType(type);
                    maintenanceRecords[index].last = last;
                    maintenanceRecords[index].interval = interval;
                    maintenanceRecords[index].months = months;
                    maintenanceRecords[index].lastDate = lastDate;
                    maintenanceRecords[index].cost = cost;
                }
            } else {
                maintenanceRecords.push({
                    id: Date.now().toString(),
                    name: type,
                    icon: getIconForType(type),
                    last: last,
                    interval: interval,
                    months,
                    lastDate,
                    cost
                });
                
                isDemoData = false;
                const demoNote = document.getElementById('demo-note');
                if(demoNote) demoNote.style.display = 'none';
            }

            try { localStorage.setItem('motomate_maint', JSON.stringify(maintenanceRecords)); } catch(e){}
            
            updateUI();
            closeModal('maintenanceModal');
            showToast("Jadwal perawatan disimpan.");
        }

        // ==========================================
        // MISC
        // ==========================================
        function setGreeting() {
            const hour = new Date().getHours();
            const greetingElement = document.getElementById('greetingText');
            let greeting = 'Selamat malam';

            if (hour >= 4 && hour < 11) greeting = 'Selamat pagi';
            else if (hour >= 11 && hour < 15) greeting = 'Selamat siang';
            else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';

            if(greetingElement) greetingElement.textContent = greeting;
        }

        function handleBerandaAISubmit(event) {
            event.preventDefault();
            const input = document.getElementById('aiInputBeranda');
            if (!input || !input.value.trim()) { showToast('Tuliskan pertanyaan kamu terlebih dahulu.'); return; }
            const question = input.value.trim();
            input.value = '';
            navigateTo('ai');
            setTimeout(() => {
                const main = document.getElementById('mainAiInput');
                if (main) { main.value = question; triggerAI(); }
            }, 150);
        }

        let chatHistory = [];
        let aiBusy = false;
        try {
            const rawChat = localStorage.getItem('motomate_chat');
            const parsedChat = rawChat ? JSON.parse(rawChat) : [];
            chatHistory = Array.isArray(parsedChat) ? parsedChat.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.text === 'string').slice(-80) : [];
        } catch (_) { chatHistory = []; }

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
        }
        function saveChatHistory() {
            try { localStorage.setItem('motomate_chat', JSON.stringify(chatHistory.slice(-80))); } catch (_) {}
        }
        function renderChatHistory() {
            const box = document.getElementById('aiChatMessages');
            if (!box) return;
            if (!chatHistory.length) {
                box.innerHTML = '<div class="chat-empty"><i class="ph ph-chat-circle-dots"></i><div>Belum ada percakapan.</div><small>Mulai dengan menanyakan kondisi atau masalah motor kamu.</small></div>';
                return;
            }
            box.innerHTML = chatHistory.map(item => `<div class="chat-row ${item.role === 'user' ? 'user' : 'assistant'}"><div class="chat-bubble">${escapeHTML(item.text).replace(/\n/g,'<br>')}</div></div>`).join('');
            box.scrollTop = box.scrollHeight;
        }
        function clearChatHistory() {
            if (!chatHistory.length || confirm('Hapus seluruh riwayat percakapan MotoMate?')) {
                chatHistory = []; saveChatHistory(); renderChatHistory(); showToast('Riwayat percakapan dihapus.');
            }
        }
        async function triggerAI(event) {
            if (event) event.preventDefault();
            const input = document.getElementById('mainAiInput');
            if (!input || !input.value.trim()) { showToast('Tuliskan pertanyaan kamu terlebih dahulu.'); return; }
            if (aiBusy) return;
            const question = input.value.trim();
            aiBusy = true;
            const sendButton = input.closest('form')?.querySelector('button[type="submit"]');
            if (sendButton) sendButton.disabled = true;
            chatHistory.push({ role: 'user', text: question });
            chatHistory.push({ role: 'assistant', text: 'MotoMate sedang menganalisis...' });
            const loadingIndex = chatHistory.length - 1;
            input.value = ''; saveChatHistory(); renderChatHistory();
            try {
                const response = await fetch('/api/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: question, history: chatHistory.slice(0, loadingIndex), motorcycle: currentMotorcycle, maintenance: maintenanceRecords }) });
                let data = {};
                try { data = await response.json(); } catch (_) {}
                if (!response.ok) throw new Error(data.error || `Server mengembalikan status ${response.status}`);
                chatHistory[loadingIndex].text = data.reply || 'AI tidak memberikan jawaban.';
            } catch (error) {
                chatHistory[loadingIndex].text = 'Maaf, AI tidak dapat dihubungi: ' + error.message;
            } finally {
                saveChatHistory(); renderChatHistory(); aiBusy = false;
                if (sendButton) sendButton.disabled = false;
            }
        }

        // ==========================================
        // MOTOR DATABASE & FUEL ESTIMATION
        // ==========================================
        const motorcycleDatabase = [
            { keys:['beat','beat fi','beat esp','beat sporty','beat street'], tank:4.2, economy:48, type:'Matic' },
            { keys:['beat pop'], tank:3.7, economy:48, type:'Matic' },
            { keys:['scoopy'], tank:4.2, economy:45, type:'Matic' },
            { keys:['genio'], tank:4.2, economy:50, type:'Matic' },
            { keys:['vario 110','vario lama'], tank:3.6, economy:43, type:'Matic' },
            { keys:['vario 125'], tank:5.5, economy:43, type:'Matic' },
            { keys:['vario 150','vario 160'], tank:5.5, economy:40, type:'Matic' },
            { keys:['pcx 150'], tank:5.9, economy:40, type:'Matic' },
            { keys:['pcx 160','pcx'], tank:8.0, economy:40, type:'Matic' },
            { keys:['nmax','nmax 155'], tank:6.6, economy:38, type:'Matic' },
            { keys:['aerox'], tank:5.5, economy:35, type:'Matic' },
            { keys:['supra x 125','supra 125'], tank:4.0, economy:48, type:'Bebek' },
            { keys:['supra fit','supra'], tank:3.7, economy:50, type:'Bebek' },
            { keys:['karisma','karisma x'], tank:4.0, economy:42, type:'Bebek' },
            { keys:['revo'], tank:4.0, economy:50, type:'Bebek' },
            { keys:['jupiter'], tank:4.0, economy:45, type:'Bebek' },
            { keys:['mio'], tank:4.2, economy:45, type:'Matic' },
            { keys:['vixion'], tank:12.0, economy:35, type:'Sport' },
            { keys:['cb150r','cb 150r'], tank:12.0, economy:35, type:'Sport' },
            { keys:['tiger'], tank:13.0, economy:30, type:'Sport' },
            { keys:['ninja ss','ninja 150 ss','kawasaki ninja ss'], tank:10.8, economy:15, type:'Sport' },
            { keys:['gsx s150','gsx-s150'], tank:11.0, economy:35, type:'Sport' },
            { keys:['cbr150'], tank:13.0, economy:32, type:'Sport' }
        ];
        function normalizeMotorName(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
        function getMotorcycleProfile() {
            const name = normalizeMotorName(currentMotorcycle.name);
            let match = motorcycleDatabase.find(item => item.keys.some(k => name.includes(normalizeMotorName(k))));
            if (match) return match;
            return { tank: currentMotorcycle.type === 'Matic' ? 5.5 : currentMotorcycle.type === 'Bebek' ? 4.0 : 11.0, economy: currentMotorcycle.fuelSystem === 'Karburator' ? 28 : 36, type: currentMotorcycle.type, generic:true };
        }
        function formatRupiah(value) { return 'Rp ' + Math.round(value).toLocaleString('id-ID'); }
        function updateFuelEstimate() {
            const profile = getMotorcycleProfile();
            const price = Number(localStorage.getItem('motomate_fuel_price')) || 10000;
            const monthlyKm = currentMotorcycle.usage === 'Touring' ? 900 : currentMotorcycle.usage === 'Campuran' ? 650 : 450;
            const liters = monthlyKm / profile.economy;
            const monthlyCost = liters * price;
            const fullTankCost = profile.tank * price;
            const range = profile.tank * profile.economy;
            const costEl = document.getElementById('fuelMonthlyCost');
            const estEl = document.getElementById('fuelEstimateText');
            const detailsEl = document.getElementById('fuelDetailsText');
            if (costEl) costEl.textContent = formatRupiah(monthlyCost) + '/bln';
            if (estEl) estEl.textContent = `Tangki ${profile.tank.toFixed(1).replace('.',',')} L · ±${liters.toFixed(1).replace('.',',')} L/bulan`;
            if (detailsEl) detailsEl.textContent = `±${profile.economy} km/L · full tank ${formatRupiah(fullTankCost)} · jarak ±${Math.round(range)} km` + (profile.generic ? ' · estimasi umum' : '');
        }

        // ==========================================
        // DYNAMIC DASHBOARD STATUS
        // ==========================================
        function getRecordStatus(name) {
            const record = maintenanceRecords.find(r => normalizeMotorName(r.name) === normalizeMotorName(name));
            return record ? calculateMaintenanceStatus(record, currentMotorcycle.mileage) : null;
        }
        function statusMarkup(status) {
            const map = { 'Baik': ['val-normal','ph-check','Normal'], 'Periksa':['val-warning','ph-warning','Periksa'], 'Segera':['val-warning','ph-warning','Segera'], 'Terlewat':['val-danger','ph-warning-octagon','Terlewat'], 'Belum diatur':['val-muted','ph-minus','Belum diatur'] };
            const x = map[status] || map['Belum diatur'];
            return `<i class="ph-bold ${x[1]}"></i> ${x[2]}`;
        }
        function updateDashboardStatus() {
            const relevant = maintenanceRecords.map(r => ({...r, ...calculateMaintenanceStatus(r,currentMotorcycle.mileage)}));
            const worst = relevant.reduce((a,b) => (a && a.remaining <= b.remaining ? a : b), null);
            const overall = worst && worst.status !== 'Baik' ? worst.status : 'Baik';
            const overallEl = document.getElementById('motorOverallStatus');
            if (overallEl) { overallEl.className = 'motor-status ' + (overall === 'Baik' ? 'status-good' : 'status-attention'); overallEl.innerHTML = `<i class="ph-fill ${overall === 'Baik' ? 'ph-check-circle' : 'ph-warning-circle'}"></i><span>${overall === 'Baik' ? 'Baik' : overall === 'Terlewat' ? 'Perlu servis' : 'Perlu perhatian'}</span>`; }
            const map = {'Ganti Oli':'status-oil','Ban':'status-tire','Rem':'status-brake'};
            Object.entries(map).forEach(([name,id]) => { const el=document.getElementById(id); const r=getRecordStatus(name); if(el) { const s=r ? r.status : 'Belum diatur'; el.className = s==='Baik'?'val-normal':(s==='Terlewat'?'val-danger':'val-warning'); el.innerHTML=statusMarkup(s); }});
            const engine=document.getElementById('status-engine'); if(engine) { engine.className = overall==='Baik'?'val-normal':(overall==='Terlewat'?'val-danger':'val-warning'); engine.innerHTML=statusMarkup(overall); }
            const monthlyCost = relevant.filter(r => r.status !== 'Baik' && r.cost).reduce((sum,r)=>sum+Number(r.cost||0),0);
            const strip=document.getElementById('maintenanceSummaryStrip'); if(strip) { const counts=relevant.reduce((o,r)=>(o[r.status]=(o[r.status]||0)+1,o),{}); strip.textContent=`${counts.Baik||0} Baik · ${counts.Periksa||0} Periksa · ${counts.Segera||0} Segera · ${counts.Terlewat||0} Terlewat` + (monthlyCost ? ` · Est. biaya ${formatRupiah(monthlyCost)}` : ''); }
        }

        function markMaintenanceDone(id) {
            const record = maintenanceRecords.find(r => String(r.id) === String(id));
            if (!record) return;
            record.last = currentMotorcycle.mileage;
            record.lastDate = new Date().toISOString().slice(0,10);
            try { localStorage.setItem('motomate_maint', JSON.stringify(maintenanceRecords)); } catch (_) {}
            updateUI(); showToast(`${record.name} ditandai sudah dilakukan.`);
        }

        // Initialize App
        document.addEventListener('DOMContentLoaded', () => {
            initData();
            setGreeting();
            renderChatHistory();
            updateFuelEstimate();
        });
