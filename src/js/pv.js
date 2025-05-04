document.addEventListener('DOMContentLoaded', function() {
    console.log('PV page initialized'); // Debug message to confirm script is running
    
    // ==================== SIDEBAR TOGGLE ====================
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        // Change icon when sidebar is open/closed
        const icon = sidebarToggle.querySelector('i');
        if (sidebar.classList.contains('active')) {
            icon.classList.replace('fa-bars', 'fa-times');
        } else {
            icon.classList.replace('fa-times', 'fa-bars');
        }
    }
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleSidebar();
        });
        
        // Close sidebar when clicking outside or on a link
        document.addEventListener('click', function(e) {
            if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
                sidebar.classList.remove('active');
                const icon = sidebarToggle.querySelector('i');
                icon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }

    // ==================== ACCOUNT DROPDOWN ====================
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            accountDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', function() {
            accountDropdown.classList.remove('show');
        });
    }
    
    // ==================== FORM DROPDOWNS ====================
    const cycleSelect = document.getElementById('cycle');
    const anneeSelect = document.getElementById('annee');
    const semestreSelect = document.getElementById('semestre');

    const cycleOptions = {
        'Licence': ['L1', 'L2', 'L3'],
        'Master': ['M1', 'M2'],
        'Ingénieur': ['ING1', 'ING2', 'ING3']
    };

    function initCycleDropdown() {
        if (!cycleSelect) return; // Safety check
        
        cycleSelect.innerHTML = '<option value="" disabled selected>Sélectionnez un cycle</option>';
        Object.keys(cycleOptions).forEach(cycle => {
            cycleSelect.innerHTML += `<option value="${cycle}">${cycle}</option>`;
        });
    }
    
    function updateAnneeOptions() {
        if (!cycleSelect || !anneeSelect) return; // Safety check
        
        const selectedCycle = cycleSelect.value;
        anneeSelect.innerHTML = '<option value="" disabled selected>Sélectionnez une année</option>';
        
        if (selectedCycle && cycleOptions[selectedCycle]) {
            cycleOptions[selectedCycle].forEach(annee => {
                anneeSelect.innerHTML += `<option value="${annee}">${annee}</option>`;
            });
            
            // Enable the year dropdown after cycle is selected
            anneeSelect.disabled = false;
        } else {
            anneeSelect.disabled = true;
            if (semestreSelect) semestreSelect.disabled = true;
        }
        
        // Always update semester options
        updateSemesterOptions();
    }

    function updateSemesterOptions() {
        if (!anneeSelect || !semestreSelect) return; // Safety check
        
        const selectedAnnee = anneeSelect.value;
        semestreSelect.innerHTML = '';
        
        if (!selectedAnnee) {
            semestreSelect.innerHTML = `
                <option value="S1">S1</option>
                <option value="S2">S2</option>
            `;
            semestreSelect.disabled = !anneeSelect.value;
            return;
        }
        
        // Enable the semester dropdown
        semestreSelect.disabled = false;
        
        let semesters = [];
        const yearNum = parseInt(selectedAnnee.replace(/\D/g, '')) || 1;
        
        if (selectedAnnee.startsWith('L')) {
            if (yearNum === 1) semesters = ['S1', 'S2'];
            else if (yearNum === 2) semesters = ['S3', 'S4'];
            else if (yearNum === 3) semesters = ['S5', 'S6'];
        } 
        else if (selectedAnnee.startsWith('M')) {
            if (yearNum === 1) semesters = ['S1', 'S2'];
            else if (yearNum === 2) semesters = ['S3', 'S4'];
        } 
        else if (selectedAnnee.startsWith('ING')) {
            if (yearNum === 1) semesters = ['S1', 'S2'];
            else if (yearNum === 2) semesters = ['S3', 'S4'];
            else if (yearNum === 3) semesters = ['S5', 'S6'];
        }
        
        semesters.forEach(semester => {
            semestreSelect.innerHTML += `<option value="${semester}">${semester}</option>`;
        });
    }
    
    // Initialize dropdowns
    function initDropdowns() {
        // Initialize form
        initCycleDropdown();
        
        // Set initial disabled states
        if (anneeSelect) anneeSelect.disabled = true;
        if (semestreSelect) semestreSelect.disabled = true;
        
        // Add event listeners
        if (cycleSelect) cycleSelect.addEventListener('change', updateAnneeOptions);
        if (anneeSelect) anneeSelect.addEventListener('change', updateSemesterOptions);
        
        // Set today's date as default
        const dateField = document.getElementById('date');
        if (dateField) dateField.valueAsDate = new Date();
    }

    // Call initialization function
    initDropdowns();
    
    // ==================== PV PREVIEW ====================
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            // Get all form values
            const formData = {
                matiere: document.getElementById('matiere')?.value || '',
                cycle: document.getElementById('cycle')?.value || '',
                annee: document.getElementById('annee')?.value || '',
                semestre: document.getElementById('semestre')?.value || '',
                date: document.getElementById('date')?.value ? 
                      new Date(document.getElementById('date').value).toLocaleDateString('fr-FR') : '',
                heure: document.getElementById('heure')?.value || '',
                lieu: document.getElementById('lieu')?.value || '',
                surveillants: document.getElementById('surveillants')?.value.replace(/\n/g, '<br>') || '',
                absents: document.getElementById('absents')?.value.replace(/\n/g, '<br>') || '',
                emergement: document.getElementById('emergement')?.value.replace(/\n/g, '<br>') || '',
                etudiantsPresents: document.getElementById('etudiants_presents')?.value || '',
                copiesRemises: document.getElementById('copies_remises')?.value || '',
                sansIdentite: document.getElementById('sans_identite')?.value || '',
                pasRendu: document.getElementById('etudiants_pas_rendu')?.value.replace(/\n/g, '<br>') || '',
                sansIdentiteNoms: document.getElementById('etudiants_sans_identite_nom')?.value.replace(/\n/g, '<br>') || '',
                incidents: document.getElementById('incidents')?.value.replace(/\n/g, '<br>') || ''
            };

            // Set all preview values
            Object.keys(formData).forEach(key => {
                const elementId = `pv${key.charAt(0).toUpperCase() + key.slice(1)}`;
                const element = document.getElementById(elementId);
                if (element) {
                    element.innerHTML = formData[key] || '-';
                }
            });

            // Show preview
            const pvPaper = document.getElementById('pvPaper');
            if (pvPaper) {
                pvPaper.style.display = 'block';
                // Smooth scroll to preview
                pvPaper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    
    // ==================== PDF GENERATION ====================
    const pdfBtn = document.getElementById('pdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', function() {
            // First check if jsPDF and html2canvas are loaded
            if (typeof jsPDF === 'undefined' || typeof html2canvas === 'undefined') {
                showNotification('PDF generation libraries are not loaded. Please check your internet connection and reload the page.', 'error');
                return;
            }
            
            // Check if preview is visible
            const pvPaper = document.getElementById('pvPaper');
            if (!pvPaper || pvPaper.style.display !== 'block') {
                if (previewBtn) previewBtn.click();
                showNotification('Veuillez prévisualiser le PV avant de générer le PDF', 'info');
                return;
            }
            
            // Generate PDF
            showNotification('Génération du PDF en cours...', 'info');
            
            const pvContent = document.getElementById('pvContent');
            if (!pvContent) {
                showNotification('Contenu du PV introuvable', 'error');
                return;
            }
            
            // Create a clone of the PV content to manipulate for PDF generation
            const pvClone = pvContent.cloneNode(true);
            
            // Set appropriate styling for the PDF
            pvClone.style.width = '210mm';
            pvClone.style.padding = '20mm';
            pvClone.style.backgroundColor = 'white';
            pvClone.style.color = 'black';
            pvClone.style.fontSize = '12pt';
            
            // Temporarily append the clone to the document for PDF generation
            pvClone.style.position = 'absolute';
            pvClone.style.left = '-9999px';
            document.body.appendChild(pvClone);
            
            html2canvas(pvClone, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                logging: false
            }).then(function(canvas) {
                // Remove the clone after canvas creation
                document.body.removeChild(pvClone);
                
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new jsPDF('p', 'mm', 'a4');
                
                // Calculate dimensions to fit the page
                const imgWidth = 210; // A4 width in mm
                const pageHeight = 297; // A4 height in mm
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;
                
                // Add image to the first page
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                
                // Add new pages if content overflows
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
                
                // Get matiere and date for filename
                const matiere = document.getElementById('matiere')?.value || 'PV';
                const dateStr = document.getElementById('date')?.value || new Date().toISOString().slice(0, 10);
                
                // Save the PDF
                pdf.save(`PV_${matiere.replace(/\s+/g, '_')}_${dateStr}.pdf`);
                showNotification('PDF généré avec succès!', 'success');
            }).catch(function(error) {
                console.error('PDF generation error:', error);
                showNotification('Erreur lors de la génération du PDF', 'error');
            });
        });
    }

    // ==================== SEND PV ====================
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            if (confirm('Voulez-vous vraiment envoyer ce PV au Chef du Département?')) {
                // Get all form values
                const formData = {
                    matiere: document.getElementById('matiere')?.value || '',
                    cycle: document.getElementById('cycle')?.value || '',
                    annee: document.getElementById('annee')?.value || '',
                    semestre: document.getElementById('semestre')?.value || '',
                    date: document.getElementById('date')?.value || '',
                    heure: document.getElementById('heure')?.value || '',
                    lieu: document.getElementById('lieu')?.value || '',
                    surveillants: document.getElementById('surveillants')?.value || '',
                    absents: document.getElementById('absents')?.value || '',
                    emargement: document.getElementById('emergement')?.value || '', // Fixed field name
                    etudiantsPresents: document.getElementById('etudiants_presents')?.value || '0',
                    copiesRemises: document.getElementById('copies_remises')?.value || '0',
                    sansIdentite: document.getElementById('sans_identite')?.value || '0',
                    sansIdentiteNoms: document.getElementById('etudiants_sans_identite_nom')?.value || '',
                    incidents: document.getElementById('incidents')?.value || ''
                };
                
                // Validate form data
                if (!formData.matiere || !formData.cycle || !formData.annee || !formData.semestre) {
                    showNotification('Veuillez remplir tous les champs obligatoires', 'error');
                    return;
                }
                
                // Send data to server
                showNotification('Envoi du PV en cours...', 'info');
                
                fetch('../db/save_pv.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || 'Erreur serveur');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        showNotification(data.message, 'success');
                        
                        // Instead of redirecting to view_pv.php, we'll show a success message and keep the user on the current page
                        // with the preview visible
                        
                        // Make sure the preview is visible
                        const pvPaper = document.getElementById('pvPaper');
                        if (pvPaper && pvPaper.style.display !== 'block') {
                            const previewBtn = document.getElementById('previewBtn');
                            if (previewBtn) previewBtn.click();
                        }
                        
                        // Show a stronger confirmation that the PV was saved and sent
                        showNotification('PV envoyé avec succès! Un email de confirmation a été envoyé au Chef du Département.', 'success');
                        
                        // Optionally, disable the send button to prevent duplicate submissions
                        sendBtn.disabled = true;
                        sendBtn.textContent = 'PV Envoyé';
                    } else {
                        showNotification(data.message, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error saving PV:', error);
                    showNotification('Erreur lors de l\'enregistrement: ' + error.message, 'error');
                });
            }
        });
    }
    // ==================== NOTIFICATIONS ====================
    function showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.padding = '12px 20px';
            notification.style.borderRadius = '6px';
            notification.style.color = 'white';
            notification.style.fontWeight = '500';
            notification.style.zIndex = '9999';
            notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            notification.style.transform = 'translateY(100px)';
            notification.style.transition = 'all 0.3s ease';
            notification.style.maxWidth = '90%';
            document.body.appendChild(notification);
        }
        
        // Set style based on type
        if (type === 'success') {
            notification.style.backgroundColor = '#2ecc71';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#e74c3c';
        } else {
            notification.style.backgroundColor = '#3498db';
        }
        
        // Set message and animate
        notification.textContent = message;
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateY(100px)';
        }, 3000);
    }
    
    // Add a message to show the page is working
    showNotification('La page PV a été chargée avec succès!', 'success');
});