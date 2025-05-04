document.addEventListener("DOMContentLoaded", function () {
    // Fetch user data from compte.php
    fetch("../db/compte.php")
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Erreur :", data.error);
                alert("Erreur : " + data.error);
                return;
            }

            // Vérification des éléments avant de modifier leur contenu
            if (document.getElementById("nom")) 
                document.getElementById("nom").textContent = data.nom || "Non défini";

            if (document.getElementById("email")) 
                document.getElementById("email").textContent = data.email || "Email non défini";

            if (document.getElementById("password")) {
                document.getElementById("password").textContent = "********"; 
                document.getElementById("password").setAttribute("data-password", data.motDePasse || "Indisponible");
            }
        })
        .catch(error => console.error("Erreur lors de la récupération des données :", error));

    // Gestion du menu déroulant (dropdown) du compte
    const accountContainer = document.getElementById("accountContainer");
    const accountDropdown = document.getElementById("accountDropdown");

    if (accountContainer && accountDropdown) {
        accountContainer.addEventListener("mouseenter", function () {
            accountDropdown.classList.add("show");
        });

        accountDropdown.addEventListener("mouseenter", function () {
            accountDropdown.classList.add("show");
        });

        accountContainer.addEventListener("mouseleave", function () {
            setTimeout(() => {
                if (!accountDropdown.matches(":hover")) {
                    accountDropdown.classList.remove("show");
                }
            }, 200);
        });

        accountDropdown.addEventListener("mouseleave", function () {
            accountDropdown.classList.remove("show");
        });
    }

    // Gestion de l'affichage du mot de passe
    let passwordVisible = false;
    const eyeIcon = document.querySelector(".eye-icon");
    const passwordSpan = document.getElementById("password");

    if (eyeIcon && passwordSpan) {
        eyeIcon.addEventListener("click", function () {
            if (passwordVisible) {
                passwordSpan.textContent = "********"; 
            } else {
                passwordSpan.textContent = passwordSpan.getAttribute("data-password") || "Indisponible";
            }
            passwordVisible = !passwordVisible;
        });
    }
});
