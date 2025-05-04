// Enhanced script for PV management with improved filtering
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading overlay
    document.getElementById('loadingOverlay').style.display = 'none';
    
    // Store all PVs for client-side filtering
    let allPVs = [];
    
    fetchAllPVs();
    
    // Setup account dropdown functionality
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            accountDropdown.style.display = accountDropdown.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            accountDropdown.style.display = 'none';
        });
    }
    
    // Select all checkbox functionality
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.pv-item input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });
    }
    
    // Add search functionality
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.addEventListener('input', function() {
            filterPVs();
        });
    }
    
    // Add filter functionality
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            filterPVs();
        });
    });
    
    // Handle filter button click
    const filterButton = document.getElementById('filterBtn');
    if (filterButton) {
        filterButton.addEventListener('click', function() {
            filterPVs();
        });
    }
    
    // Handle export button click
    const exportButton = document.getElementById('exportBtn');
    if (exportButton) {
        exportButton.addEventListener('click', function() {
            exportPVs();
        });
    }
    
    // Handle batch approval button
    const batchApproveBtn = document.getElementById('batchApproveBtn');
    if (batchApproveBtn) {
        batchApproveBtn.addEventListener('click', function() {
            batchApprove();
        });
    }
    
    // Handle batch reject button
    const batchRejectBtn = document.getElementById('batchRejectBtn');
    if (batchRejectBtn) {
        batchRejectBtn.addEventListener('click', function() {
            batchReject();
        });
    }
    
    // Handle batch delete button
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            deleteSelectedPVs();
        });
    }
    
    // Handle reset filters button
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            resetFilters();
        });
    }
    
    // Upload new PV button
    const uploadNewPVBtn = document.getElementById('uploadNewPVBtn');
    if (uploadNewPVBtn) {
        uploadNewPVBtn.addEventListener('click', function() {
            document.getElementById('uploadModal').style.display = 'block';
        });
    }
    
    // Modal close buttons
    const closeButtons = document.querySelectorAll('.close-btn, .close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            closeAllModals();
        });
    });
    
    // Help button
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', function() {
            document.getElementById('helpModal').style.display = 'block';
        });
    }
});

// Fetch PV data from the server
function fetchPVData() {
    const pvContainer = document.querySelector('.pv-container');
    if (!pvContainer) return;

    pvContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Chargement des PVs...</p>
        </div>
    `;

    const searchTerm = document.querySelector('.search-box')?.value || '';
    const semestreFilter = document.querySelector('select[name="semestre"]')?.value || '';
    const matiereFilter = document.querySelector('select[name="matiere"]')?.value || '';
    const statusFilter = document.querySelector('select[name="status"]')?.value || '';
    const dateFilter = document.querySelector('select[name="date"]')?.value || '';

    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (semestreFilter) params.append('semestre', semestreFilter);
    if (matiereFilter) params.append('matiere', matiereFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (dateFilter) params.append('date', dateFilter);

    fetch(`../db/get_pv_data.php?${params.toString()}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.success) {
                throw new Error(data.message || 'No data received from server');
            }
            
            // Filter out unwanted matières from the response
            const filteredPVs = data.pvs.filter(pv => 
                pv.matiere && 
                !pv.matiere.toLowerCase().includes('ov envoyer')
            );
            
            window.allPVs = filteredPVs;
            displayPVData(filteredPVs);
            
            // Only update filter UI if we have the necessary elements
            if (document.querySelector('.search-box') && 
                document.querySelector('select[name="semestre"]') &&
                document.querySelector('select[name="matiere"]') &&
                document.querySelector('select[name="status"]') &&
                document.querySelector('select[name="date"]')) {
                updateFilterUI();
            }
        })
        .catch(error => {
            console.error('Error fetching filtered PV data:', error);
            
            if (window.allPVs && window.allPVs.length > 0) {
                const filteredPVs = clientSideFilterPVs(window.allPVs);
                displayPVData(filteredPVs);
                showNotification('Filtrage côté client appliqué (erreur serveur)', 'warning');
            } else {
                pvContainer.innerHTML = `
                    <div class="error-message">
                        <p>Erreur lors du filtrage</p>
                        <p>${error.message}</p>
                        <button class="btn" onclick="fetchAllPVs()">Réessayer</button>
                    </div>
                `;
            }
        });
}

// Fetch all PVs with no filters for client-side filtering
function fetchAllPVs() {
    const pvContainer = document.querySelector('.pv-container');
    if (!pvContainer) return;

    pvContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Chargement des PVs...</p>
        </div>
    `;
    
    fetch(`../db/get_pv_data.php`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.success) {
                throw new Error(data.message || 'No data received from server');
            }
            
            // Filter out unwanted matières from the data
            const filteredPVs = data.pvs.filter(pv => 
                pv.matiere && 
                !pv.matiere.toLowerCase().includes('ov envoyer')
            );
            
            window.allPVs = filteredPVs;
            populateMatiereFilter(filteredPVs);
            
            const clientFilteredPVs = clientSideFilterPVs(filteredPVs);
            displayPVData(clientFilteredPVs);
        })
        .catch(error => {
            console.error('Error fetching all PV data:', error);
            pvContainer.innerHTML = `
                <div class="error-message">
                    <p>Erreur lors du chargement des PVs.</p>
                    <p>${error.message}</p>
                </div>
            `;
            
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'flex';
        });
}


// Client-side filtering function
function clientSideFilterPVs(pvs) {
    if (!pvs || pvs.length === 0) return [];
    
    const searchTerm = document.querySelector('.search-box')?.value?.toLowerCase() || '';
    const semestreFilter = document.querySelector('select[name="semestre"]')?.value || '';
    const matiereFilter = document.querySelector('select[name="matiere"]')?.value || '';
    const statusFilter = document.querySelector('select[name="status"]')?.value || '';
    const dateFilter = document.querySelector('select[name="date"]')?.value || '';
    
    return pvs.filter(pv => {
        // Skip invalid PVs or those with unwanted matières
        if (!pv.matiere || pv.matiere.toLowerCase().includes('ov envoyer')) {
            return false;
        }
        
        // Search term filter
        if (searchTerm) {
            const matchesSearch = 
                (pv.matiere && pv.matiere.toLowerCase().includes(searchTerm)) ||
                (pv.nomProfesseur && pv.nomProfesseur.toLowerCase().includes(searchTerm)) ||
                (pv.groupe && pv.groupe.toLowerCase().includes(searchTerm)) ||
                (pv.localisation && pv.localisation.toLowerCase().includes(searchTerm));
            
            if (!matchesSearch) return false;
        }
        
        // Semestre filter
        if (semestreFilter && pv.semestre !== semestreFilter) return false;
        
        // Matière filter - exact match (case sensitive)
        if (matiereFilter && matiereFilter !== "") {
            if (pv.matiere !== matiereFilter) {
                return false;
            }
        }

        
        // Date filter
        if (dateFilter && !matchesDateFilter(pv.date, dateFilter)) return false;
        
        return true;
    });
}
function populateMatiereFilter(pvs) {
    if (!pvs || pvs.length === 0) return;
    
    const matiereSelect = document.querySelector('select[name="matiere"]');
    if (!matiereSelect) return;

    // Store current selection
    const currentValue = matiereSelect.value;
    
    // Clear existing options except the first one ("Toutes les matières")
    while (matiereSelect.options.length > 1) {
        matiereSelect.remove(1);
    }
    
    // Get unique matières and filter out unwanted ones
    const matieres = [...new Set(pvs.map(pv => pv.matiere).filter(Boolean))];
    
    // Filter out specific unwanted matières (like "les matieres de ov envoyer")
    const filteredMatieres = matieres.filter(matiere => 
        !matiere.toLowerCase().includes('ov envoyer') && 
        matiere.trim() !== ''
    ).sort();
    
    // Add filtered options
    filteredMatieres.forEach(matiere => {
        const option = document.createElement('option');
        option.value = matiere;
        option.textContent = matiere;
        matiereSelect.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentValue && filteredMatieres.includes(currentValue)) {
        matiereSelect.value = currentValue;
    }
}

function displayPVData(data) {
    const emptyState = document.getElementById('emptyState');
    const pvContainer = document.querySelector('.pv-container');
    
    if (!pvContainer) {
        console.error('PV container element not found');
        return;
    }
    
    if (!data || data.length === 0) {
        pvContainer.innerHTML = `
            <div class="no-data-message">
                <p>Aucun PV de surveillance trouvé.</p>
            </div>
        `;
        
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        return;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // Group PVs by matiere
    const groupedPVs = {};
    data.forEach(pv => {
        const matiere = pv.matiere || 'Non spécifié';
        if (!groupedPVs[matiere]) {
            groupedPVs[matiere] = [];
        }
        groupedPVs[matiere].push(pv);
    });
    
    // Generate HTML for each matiere group
    let htmlContent = '';
    for (const [matiere, pvs] of Object.entries(groupedPVs)) {
        htmlContent += `
            <div class="subject-section" data-matiere="${matiere}">
                <div class="subject-header">
                    <h3>${matiere}</h3>
                    <span class="pv-count">${pvs.length} PV</span>
                </div>
                <div class="pv-list">
                    ${pvs.map(pv => createPVItemHTML(pv)).join('')}
                </div>
            </div>
        `;
    }
    
    // Update the DOM
    pvContainer.innerHTML = htmlContent;
    
    // Add event listeners to new elements
    addEventListeners();
}

// Create HTML for a single PV item
function createPVItemHTML(pv) {
    const date = pv.date ? new Date(pv.date).toLocaleDateString('fr-FR') : 'Date non spécifiée';
    const professeur = pv.nomProfesseur || 'Non spécifié';
    const salle = pv.localisation || 'Non spécifiée';
    const incidents = pv.incidents ? 'Oui' : 'Non';
    
    // Add status indicator class
    let statusClass = '';
    let statusIcon = '';
    
    switch(pv.status) {
        case 'verified':
            statusClass = 'verified';
            statusIcon = '<i class="fas fa-check-circle" title="Vérifié"></i>';
            break;
        case 'pending':
            statusClass = 'pending';
            statusIcon = '<i class="fas fa-clock" title="En attente"></i>';
            break;
        case 'rejected':
            statusClass = 'rejected';
            statusIcon = '<i class="fas fa-times-circle" title="Rejeté"></i>';
            break;
        default:
            statusClass = '';
            statusIcon = '';
    }
    
    return `
        <div class="pv-item ${statusClass}" data-id="${pv.idSurveillance}" data-matiere="${pv.matiere}" data-cycle="${pv.cycle}" data-semestre="${pv.semestre}" data-date="${pv.date}" data-status="${pv.status || 'pending'}">
            <input type="checkbox" id="pv-${pv.idSurveillance}" class="pv-checkbox">
            <label for="pv-${pv.idSurveillance}" style="display: none;">Sélectionner</label>
            
            <div class="pv-details">
                <div class="pv-title">
                    ${statusIcon}
                    PV de Surveillance - ${pv.matiere}
                </div>
                <div class="pv-meta">
                    <span><i class="far fa-calendar-alt"></i> ${date}</span>
                    <span><i class="far fa-clock"></i> ${pv.heureDebut || 'Heure non spécifiée'}</span>
                    <span><i class="fas fa-user"></i> ${professeur}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${salle}</span>
                    <span><i class="fas fa-exclamation-circle"></i> Incidents: ${incidents}</span>
                </div>
            </div>
            
            <div class="pv-actions">
                <button class="btn view-btn view-details-btn" data-id="${pv.idSurveillance}">
                    <i class="fas fa-eye"></i> Voir
                </button>
                <button class="btn download-btn download-pdf-btn" data-id="${pv.idSurveillance}">
                    <i class="fas fa-file-pdf"></i> PDF
                </button>
                <button class="btn edit-btn print-btn" data-id="${pv.idSurveillance}">
                    <i class="fas fa-print"></i> Imprimer
                </button>
            </div>
        </div>
    `;
}

// Add event listeners to newly created elements
function addEventListeners() {
    // Toggle PV list visibility
    const subjectHeaders = document.querySelectorAll('.subject-header');
    subjectHeaders.forEach(header => {
        header.addEventListener('click', function() {
            this.classList.toggle('active');
            const pvList = this.nextElementSibling;
            pvList.style.display = this.classList.contains('active') ? 'block' : 'none';
        });
        
        // Open the first section by default
        if (subjectHeaders.length > 0 && subjectHeaders[0] === header) {
            header.classList.add('active');
            const pvList = header.nextElementSibling;
            pvList.style.display = 'block';
        }
    });
    
   // View details button - redirect to your PHP view page
document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const pvId = this.getAttribute('data-id');
        window.open(`../db/view_pv.php?id=${pvId}`, '_blank', 'width=800,height=1000');
    });
});
    // Download PDF button
    document.querySelectorAll('.download-pdf-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pvId = this.getAttribute('data-id');
            window.location.href = `../db/download_pv_pdf.php?id=${pvId}`;
        });
    });
    
    // Print button
    document.querySelectorAll('.print-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pvId = this.getAttribute('data-id');
            window.open(`../db/print_pv.php?id=${pvId}`, '_blank');
        });
    });
}

// Function to filter PVs
// Replace the current filterPVs function with this enhanced version
function filterPVs() {
    // First try server-side filtering
    fetchPVData();
    
    // As a fallback, if we already have data, apply client-side filtering
    if (window.allPVs && window.allPVs.length > 0) {
        const filteredPVs = clientSideFilterPVs(window.allPVs);
        displayPVData(filteredPVs);
    }
}

// Enhance the fetchPVData function to better handle errors
function fetchPVData() {
    const pvContainer = document.querySelector('.pv-container');
    if (!pvContainer) return;

    pvContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Chargement des PVs...</p>
        </div>
    `;

    const searchTerm = document.querySelector('.search-box')?.value || '';
    const semestreFilter = document.querySelector('select[name="semestre"]')?.value || '';
    const matiereFilter = document.querySelector('select[name="matiere"]')?.value || '';
    const statusFilter = document.querySelector('select[name="status"]')?.value || '';
    const dateFilter = document.querySelector('select[name="date"]')?.value || '';

    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (semestreFilter) params.append('semestre', semestreFilter);
    if (matiereFilter) params.append('matiere', matiereFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (dateFilter) params.append('date', dateFilter);

    fetch(`../db/get_pv_data.php?${params.toString()}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.success) {
                throw new Error(data.message || 'No data received from server');
            }
            
            // Filter out unwanted matières from the response
            const filteredPVs = data.pvs.filter(pv => 
                pv.matiere && 
                !pv.matiere.toLowerCase().includes('ov envoyer')
            );
            
            window.allPVs = filteredPVs;
            displayPVData(filteredPVs);
            updateFilterUI();
        })
        .catch(error => {
            console.error('Error fetching filtered PV data:', error);
            
            if (window.allPVs && window.allPVs.length > 0) {
                const filteredPVs = clientSideFilterPVs(window.allPVs);
                displayPVData(filteredPVs);
                showNotification('Filtrage côté client appliqué (erreur serveur)', 'warning');
            } else {
                pvContainer.innerHTML = `
                    <div class="error-message">
                        <p>Erreur lors du filtrage</p>
                        <p>${error.message}</p>
                        <button class="btn" onclick="fetchAllPVs()">Réessayer</button>
                    </div>
                `;
            }
        });
}

// Add this function to visually indicate active filters
function updateFilterUI() {
    const searchBox = document.querySelector('.search-box');
    const semestreSelect = document.querySelector('select[name="semestre"]');
    const matiereSelect = document.querySelector('select[name="matiere"]');
    const statusSelect = document.querySelector('select[name="status"]');
    const dateSelect = document.querySelector('select[name="date"]');
    
    const searchTerm = searchBox?.value || '';
    const semestreFilter = semestreSelect?.value || '';
    const matiereFilter = matiereSelect?.value || '';
    const statusFilter = statusSelect?.value || '';
    const dateFilter = dateSelect?.value || '';
    
    // Add/remove active class to filter elements if they exist
    if (searchBox) searchBox.classList.toggle('active', searchTerm !== '');
    if (semestreSelect) semestreSelect.classList.toggle('active', semestreFilter !== '');
    if (matiereSelect) matiereSelect.classList.toggle('active', matiereFilter !== '');
    if (statusSelect) statusSelect.classList.toggle('active', statusFilter !== '');
    if (dateSelect) dateSelect.classList.toggle('active', dateFilter !== '');
    
    // Update filter count badge if you have one
    const activeFilterCount = [searchTerm, semestreFilter, matiereFilter, statusFilter, dateFilter]
        .filter(val => val !== '').length;
    
    const filterBadge = document.querySelector('.filter-badge');
    if (filterBadge) {
        filterBadge.textContent = activeFilterCount > 0 ? activeFilterCount : '';
        filterBadge.style.display = activeFilterCount > 0 ? 'flex' : 'none';
    }
}

// Reset all filters
function resetFilters() {
    document.querySelector('.search-box').value = '';
    document.querySelector('select[name="semestre"]').value = '';
    document.querySelector('select[name="matiere"]').value = '';
    document.querySelector('select[name="status"]').value = '';
    document.querySelector('select[name="date"]').value = '';
    
    // Refresh data
    fetchPVData();
}

// Helper function to match date filters
function matchesDateFilter(dateStr, filter) {
    if (!dateStr || filter === '') return true;
    
    const pvDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    switch (filter) {
        case 'today':
            return pvDate.toDateString() === today.toDateString();
        case 'yesterday':
            return pvDate.toDateString() === yesterday.toDateString();
        case 'thisWeek':
            return pvDate >= thisWeekStart;
        case 'thisMonth':
            return pvDate >= thisMonthStart;
        default:
            return true;
    }
}

// Function to download PV as PDF
function downloadPVPDF(pvId) {
    window.location.href = `../db/download_pv_pdf.php?id=${pvId}`;
}

// Function to print PV
function printPV(pvId) {
    window.open(`../db/print_pv.php?id=${pvId}`, '_blank');
}

// Function to export filtered PVs
function exportPVs() {
    const searchTerm = document.querySelector('.search-box').value || '';
    const semestreFilter = document.querySelector('select[name="semestre"]').value || '';
    const matiereFilter = document.querySelector('select[name="matiere"]').value || '';
    const statusFilter = document.querySelector('select[name="status"]').value || '';
    const dateFilter = document.querySelector('select[name="date"]').value || '';
    
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (semestreFilter) params.append('semestre', semestreFilter);
    if (matiereFilter) params.append('matiere', matiereFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (dateFilter) params.append('date', dateFilter);
    
    window.location.href = `export_pvs.php?${params.toString()}`;
}

// Function to delete selected PVs
// Function to delete selected PVs
function deleteSelectedPVs() {
    const selectedPVs = document.querySelectorAll('.pv-item input[type="checkbox"]:checked');
    
    if (selectedPVs.length === 0) {
        showNotification('Veuillez sélectionner au moins un PV à supprimer.', 'warning');
        return;
    }
    
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Mise à jour du contenu de la modale
    confirmModal.querySelector('.modal-header h2').textContent = 'Confirmation de suppression';
    confirmMessage.innerHTML = `
        <div class="warning-icon">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <p>Vous êtes sur le point de supprimer <strong>${selectedPVs.length} PV(s)</strong>.</p>
        <p class="warning-text">Cette action est irréversible. Voulez-vous vraiment continuer ?</p>
    `;
    
    // Afficher la modale
    confirmModal.style.display = 'block';
    
    // Gestion des événements
    const handleConfirm = function() {
        const pvIds = Array.from(selectedPVs).map(checkbox => 
            checkbox.closest('.pv-item').getAttribute('data-id')
        );
        
        // Envoyer la requête de suppression au serveur
        fetch('../db/delete_pvs.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: pvIds })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Supprimer les éléments du DOM
                selectedPVs.forEach(checkbox => {
                    const pvItem = checkbox.closest('.pv-item');
                    if (pvItem) pvItem.remove();
                });
                
                // Mettre à jour les PVs stockés
                if (window.allPVs) {
                    window.allPVs = window.allPVs.filter(pv => !pvIds.includes(pv.idSurveillance.toString()));
                }
                
                showNotification(`${pvIds.length} PV(s) supprimé(s) avec succès.`, 'success');
            } else {
                showNotification(data.message || 'Erreur lors de la suppression', 'error');
            }
        })
        .catch(error => {
            showNotification('Erreur de connexion lors de la suppression', 'error');
        });
        
        closeAllModals();
        
        // Nettoyer les gestionnaires d'événements
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    const handleCancel = function() {
        closeAllModals();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    // Ajouter les nouveaux gestionnaires d'événements
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    // Gestion de la fermeture via le bouton X ou en cliquant à l'extérieur
    const closeBtn = confirmModal.querySelector('.close-btn');
    closeBtn.onclick = function() {
        closeAllModals();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    window.onclick = function(event) {
        if (event.target === confirmModal) {
            closeAllModals();
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        }
    };
}

// Function to approve a batch of PVs
function batchApprove() {
    const selectedPVs = document.querySelectorAll('.pv-item input[type="checkbox"]:checked');
    
    if (selectedPVs.length === 0) {
        showNotification('Veuillez sélectionner au moins un PV à approuver.', 'warning');
        return;
    }
    
    const confirmMessage = document.getElementById('confirmMessage');
    confirmMessage.textContent = `Êtes-vous sûr de vouloir approuver ${selectedPVs.length} PV(s) ?`;
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = function() {
        const pvIds = Array.from(selectedPVs).map(checkbox => 
            checkbox.closest('.pv-item').getAttribute('data-id')
        );
        
        // Send approval request to server
        fetch('../db/approve_pvs.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: pvIds })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update UI to reflect new status
                selectedPVs.forEach(checkbox => {
                    const pvItem = checkbox.closest('.pv-item');
                    if (pvItem) {
                        pvItem.setAttribute('data-status', 'verified');
                        pvItem.className = pvItem.className.replace(/pending|rejected/g, '') + ' verified';
                        
                        const titleEl = pvItem.querySelector('.pv-title');
                        const oldIcon = titleEl.querySelector('i');
                        if (oldIcon) oldIcon.remove();
                        
                        titleEl.insertAdjacentHTML('afterbegin', '<i class="fas fa-check-circle" title="Vérifié"></i>');
                    }
                });
                
                // Update status in stored PVs
                if (window.allPVs) {
                    pvIds.forEach(id => {
                        const pvIndex = window.allPVs.findIndex(pv => pv.idSurveillance.toString() === id);
                        if (pvIndex !== -1) {
                            window.allPVs[pvIndex].status = 'verified';
                        }
                    });
                }
                
                showNotification(`${pvIds.length} PV(s) approuvé(s) avec succès.`, 'success');
            } else {
                showNotification(data.message || 'Erreur lors de l\'approbation', 'error');
            }
        })
        .catch(error => {
            showNotification('Erreur de connexion lors de l\'approbation', 'error');
        });
        
        closeAllModals();
    };
    
    document.getElementById('confirmModal').style.display = 'block';
}

// Function to reject a batch of PVs
function batchReject() {
    const selectedPVs = document.querySelectorAll('.pv-item input[type="checkbox"]:checked');
    
    if (selectedPVs.length === 0) {
        showNotification('Veuillez sélectionner au moins un PV à rejeter.', 'warning');
        return;
    }
    
    const confirmMessage = document.getElementById('confirmMessage');
    confirmMessage.textContent = `Êtes-vous sûr de vouloir rejeter ${selectedPVs.length} PV(s) ?`;
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = function() {
        const pvIds = Array.from(selectedPVs).map(checkbox => 
            checkbox.closest('.pv-item').getAttribute('data-id')
        );
        
        // Send rejection request to server
        fetch('../db/reject_pvs.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: pvIds })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update UI to reflect new status
                selectedPVs.forEach(checkbox => {
                    const pvItem = checkbox.closest('.pv-item');
                    if (pvItem) {
                        pvItem.setAttribute('data-status', 'rejected');
                        pvItem.className = pvItem.className.replace(/pending|verified/g, '') + ' rejected';
                        
                        const titleEl = pvItem.querySelector('.pv-title');
                        const oldIcon = titleEl.querySelector('i');
                        if (oldIcon) oldIcon.remove();
                        
                        titleEl.insertAdjacentHTML('afterbegin', '<i class="fas fa-times-circle" title="Rejeté"></i>');
                    }
                });
                
                // Update status in stored PVs
                if (window.allPVs) {
                    pvIds.forEach(id => {
                        const pvIndex = window.allPVs.findIndex(pv => pv.idSurveillance.toString() === id);
                        if (pvIndex !== -1) {
                            window.allPVs[pvIndex].status = 'rejected';
                        }
                    });
                }
                
                showNotification(`${pvIds.length} PV(s) rejeté(s).`, 'warning');
            } else {
                showNotification(data.message || 'Erreur lors du rejet', 'error');
            }
        })
        .catch(error => {
            showNotification('Erreur de connexion lors du rejet', 'error');
        });
        
        closeAllModals();
    };
    
    document.getElementById('confirmModal').style.display = 'block';
}

// Function to close all modals
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Function to show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}