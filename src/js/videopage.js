document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    const idUtilisateur = urlParams.get('idUtilisateur'); // Récupérer l'ID
    alert("Role from URL: '" + role + "'");
    console.log("Role from URL:", role);
    console.log("User ID from URL:", idUtilisateur);
    const video = document.getElementById("loginVideo");

    console.log("Role from URL:", role);
    console.log("User ID from URL:", idUtilisateur);
    // After successful login:
sessionStorage.setItem('idUtilisateur', idUtilisateur);
localStorage.setItem('idUtilisateur', idUtilisateur);
document.cookie = `idUtilisateur=${idUtilisateur}; path=/; max-age=86400`;

    if (video) {
        video.onended = function () {
            // Inclure l'idUtilisateur dans les redirections
            if (role === 'administrateur') {
                window.location.href = `administrateur.html?idUtilisateur=${idUtilisateur}`;
            } else if (role === 'professeur') {
                window.location.href = `prof.html?idUtilisateur=${idUtilisateur}`;
            } else if (role === 'admin') {
                window.location.href = `gestion.html?idUtilisateur=${idUtilisateur}`;
            } else {
                alert("Unknown role, returning to login.");
                window.location.href = "login.html";
            }
        };
    } else {
        console.error("Video element not found.");
    }
    
});