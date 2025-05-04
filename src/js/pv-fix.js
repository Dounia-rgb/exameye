/**
 * PV Form Emergency Fix
 * 
 * This script completely overwrites the draft restoration functionality
 * to fix the page crashing issue.
 */

document.addEventListener('DOMContentLoaded', function() {
    // First, disable the automatic draft loading that's causing the crash
    // This is a safe way to prevent the original problematic code from running
    if (window.loadSavedFormData) {
        window.originalLoadSavedFormData = window.loadSavedFormData;
        window.loadSavedFormData = function() {
            console.log("Original loadSavedFormData intercepted to prevent crashes");
        };
    }
    
    // Wait for page to be fully loaded before attempting to restore data
    setTimeout(function() {
        safelyRestoreDraft();
    }, 1000);
    
    // Add a manual restore button as a backup method
    addRestoreButton();
});

/**
 * Safe draft restoration that won't crash the page
 */
function safelyRestoreDraft() {
    try {
        // Check if there's saved data
        const savedData = localStorage.getItem('pvFormData');
        if (!savedData) return;
        
        // Parse the data
        let formData;
        try {
            formData = JSON.parse(savedData);
        } catch (e) {
            console.error("Failed to parse saved form data:", e);
            localStorage.removeItem('pvFormData');
            return;
        }
        
        // Create a non-modal notification asking to restore
        createRestorePrompt(formData);
        
    } catch (e) {
        console.error("Error in safelyRestoreDraft:", e);
    }
}

/**
 * Creates a floating prompt instead of using confirm() which might be causing issues
 */
function createRestorePrompt(formData) {
    // Create container
    const prompt = document.createElement('div');
    prompt.style.position = 'fixed';
    prompt.style.bottom = '20px';
    prompt.style.right = '20px';
    prompt.style.backgroundColor = 'white';
    prompt.style.padding = '15px';
    prompt.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    prompt.style.borderRadius = '5px';
    prompt.style.zIndex = '10000';
    prompt.style.maxWidth = '300px';
    
    // Add content
    prompt.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Un brouillon de PV a été trouvé</div>
        <div style="margin-bottom: 15px;">Voulez-vous le restaurer?</div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="restore-no" style="padding: 8px 12px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">Non</button>
            <button id="restore-yes" style="padding: 8px 12px; background: #2c387e; color: white; border: none; border-radius: 4px; cursor: pointer;">Oui</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(prompt);
    
    // Handle button clicks
    document.getElementById('restore-yes').addEventListener('click', function() {
        document.body.removeChild(prompt);
        applyFormData(formData);
    });
    
    document.getElementById('restore-no').addEventListener('click', function() {
        document.body.removeChild(prompt);
        localStorage.removeItem('pvFormData');
    });
}

/**
 * Safely applies saved form data
 */
function applyFormData(formData) {
    try {
        // First, apply simple text inputs
        Object.keys(formData).forEach(key => {
            const input = document.getElementById(key);
            if (input && formData[key]) {
                // Only set value if element exists
                input.value = formData[key];
            }
        });
        
        // Handle dropdowns separately with proper sequencing
        handleDropdowns(formData);
        
        // Show success message
        showSafeNotification('Brouillon restauré avec succès', 'success');
    } catch (e) {
        console.error("Error applying form data:", e);
        showSafeNotification('Problème lors de la restauration du brouillon', 'error');
    }
}

/**
 * Handles the complex dropdown dependencies
 */
function handleDropdowns(formData) {
    // Set cycle first
    const cycleSelect = document.getElementById('cycle');
    if (cycleSelect && formData.cycle) {
        cycleSelect.value = formData.cycle;
        
        // Manually trigger change event to update dependent dropdowns
        const event = new Event('change');
        cycleSelect.dispatchEvent(event);
        
        // Set annee after a delay to ensure options are populated
        setTimeout(function() {
            const anneeSelect = document.getElementById('annee');
            if (anneeSelect && formData.annee) {
                anneeSelect.value = formData.annee;
                
                // Trigger change event
                anneeSelect.dispatchEvent(new Event('change'));
                
                // Set semestre after another delay
                setTimeout(function() {
                    const semestreSelect = document.getElementById('semestre');
                    if (semestreSelect && formData.semestre) {
                        semestreSelect.value = formData.semestre;
                    }
                }, 200);
            }
        }, 200);
    }
}

/**
 * Adds a manual restore button as a backup method
 */
function addRestoreButton() {
    // Only add if there's saved data
    if (!localStorage.getItem('pvFormData')) return;
    
    const button = document.createElement('button');
    button.textContent = 'Restaurer brouillon';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.left = '20px';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#2c387e';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '9999';
    
    button.addEventListener('click', function() {
        safelyRestoreDraft();
    });
    
    document.body.appendChild(button);
}

/**
 * Safe notification function that doesn't depend on the original code
 */
function showSafeNotification(message, type) {
    // Try to use the original function if it exists
    if (typeof window.showNotification === 'function') {
        try {
            window.showNotification(message, type);
            return;
        } catch (e) {
            console.error("Error using original showNotification:", e);
        }
    }
    
    // Fallback to our own implementation
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.zIndex = '10000';
    
    // Set color based on type
    if (type === 'success') {
        notification.style.backgroundColor = '#2ecc71';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#e74c3c';
    } else {
        notification.style.backgroundColor = '#3498db';
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(function() {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}