// Get existing elements
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle functionality
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Account dropdown functionality
    const accountIcon = document.getElementById('accountIcon');
    const accountDropdown = document.getElementById('accountDropdown');
    
    if (accountIcon && accountDropdown) {
        accountIcon.addEventListener('click', function() {
            accountDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!accountIcon.contains(event.target) && !accountDropdown.contains(event.target)) {
                accountDropdown.classList.remove('active');
            }
        });
    }
    
    // Logout functionality
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
});

/**
 * Handle user logout
 */
function logout() {
    // Clear any authentication tokens from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // You may want to clear any other stored session data
    sessionStorage.clear();
    
    // Optional: Send a request to server to invalidate the session
    // If you have a backend API endpoint for logout
    /*
    fetch('/api/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        }
    })
    .then(response => {
        if (response.ok) {
            // Redirect to login page regardless of response
            window.location.href = '/index.html';
        } else {
            console.error('Logout failed on server');
            // Still redirect to login page
            window.location.href = '/index.html';
        }
    })
    .catch(error => {
        console.error('Logout error:', error);
        // Still redirect to login page
        window.location.href = '/indexhtml';
    });
    */
    
    // For a simple implementation without server validation
    // Just redirect to login page
    window.location.href = '/index.html';
}