document.addEventListener('DOMContentLoaded', function() {
    // Get logged-in professor's data
    fetchProfessorData();
    
    // ==================== SIDEBAR TOGGLE ====================
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
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
        
        // Close sidebar when clicking outside
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
    const accountContainer = document.getElementById('accountContainer');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            accountDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!accountContainer.contains(e.target)) {
                accountDropdown.classList.remove('show');
            }
        });
    }

    // Close sidebar on window resize if screen becomes larger than mobile breakpoint
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
            const icon = sidebarToggle.querySelector('i');
            icon.classList.replace('fa-times', 'fa-bars');
        }
    });

    // Add touch events for mobile
    const touchElements = document.querySelectorAll('.menu li, .account-icon, button, .action-btn');
    
    touchElements.forEach(element => {
        element.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        }, { passive: true });
        
        element.addEventListener('touchend', function() {
            this.style.opacity = '1';
        }, { passive: true });
    });
});

function fetchProfessorData() {
    // Define all possible paths to try
    const possiblePaths = [
        '../db/prof.php',      // Original path
                // Current directory
    ];
    
    console.log('Attempting to fetch professor data');
    
    // Try the first path
    tryFetchPath(possiblePaths, 0);
}

function tryFetchPath(paths, index) {
    if (index >= paths.length) {
        console.error('All paths failed. Could not fetch professor data.');
        setFallbackName();
        return;
    }
    
    const path = paths[index];
    console.log(`Trying path (${index + 1}/${paths.length}): ${path}`);
    
    fetch(path, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin' // Include cookies
    })
    .then(response => {
        console.log(`Response for ${path}:`, {
            status: response.status,
            contentType: response.headers.get('content-type'),
            ok: response.ok
        });
        
        if (!response.ok) {
            return response.text().then(text => {
                console.error(`Error response from ${path} (${response.status}):`, text.substring(0, 200));
                throw new Error(`Server returned ${response.status} for ${path}`);
            });
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return response.text().then(text => {
                console.error(`Response from ${path} is not JSON. Content-Type:`, contentType);
                console.error('Response text:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
                throw new Error(`Response from ${path} is not JSON`);
            });
        }
        
        return response.json();
    })
    .then(data => {
        console.log('Professor data received:', data);
        
        // Check if there's an error property in the JSON
        if (data.error) {
            console.error('Server returned error in JSON:', data.error);
            throw new Error(data.error);
        }
        
        // Update the professor name in the welcome message
        const professorNameElement = document.querySelector('.professor-name');
        if (professorNameElement && data.nom) {
            professorNameElement.textContent = data.nom;
        } else {
            console.warn('Either professorNameElement not found or data.nom is missing');
            if (!professorNameElement) {
                console.warn('professorNameElement not found in the DOM');
            }
            if (!data.nom) {
                console.warn('data.nom is missing from the response', data);
            }
        }
    })
    .catch(error => {
        console.error(`Error with path ${path}:`, error);
        // Try next path
        tryFetchPath(paths, index + 1);
    });
}

function setFallbackName() {
    const professorNameElement = document.querySelector('.professor-name');
    if (professorNameElement) {
        professorNameElement.textContent = 'Professor';
        console.log('Set fallback name "Professor"');
    } else {
        console.warn('professorNameElement not found for fallback name');
    }
}