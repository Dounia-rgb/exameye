document.addEventListener("DOMContentLoaded", () => {
  const profSelect = document.getElementById("professeur");
  const profName = document.getElementById("profName");
  const examList = document.getElementById("examList");
  const addExamBtn = document.getElementById("addExam");
  const previewBtn = document.getElementById("previewBtn");
  const convocationForm = document.getElementById("convocationForm");

  // Amélioré: Récupération des professeurs
  fetch("../db/professeurs.php")
    .then(response => {
      // Vérifier d'abord si la requête a réussi
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Données reçues des professeurs:", data); // Pour le débogage
      
      // Initialisation du sélecteur
      profSelect.innerHTML = '<option value="">Sélectionnez un professeur</option>';
      
      // Vérifier que data est bien un tableau et ne contient pas d'erreur
      if (Array.isArray(data)) {
        if (data.length === 0) {
          console.warn("Aucun professeur trouvé dans la base de données");
          profSelect.innerHTML += '<option value="" disabled>Aucun professeur disponible</option>';
        } else {
          // C'est un tableau avec des données, on peut l'utiliser
          data.forEach(prof => {
            // Utiliser uniquement le nom puisqu'il n'y a pas de prénom
            const nom = prof.nom || "";
            const option = document.createElement("option");
            option.value = prof.idUtilisateur;
            option.textContent = nom.trim();
            profSelect.appendChild(option);
          });
        }
      } else if (data.error) {
        // Le serveur a renvoyé une erreur
        console.error("Erreur du serveur:", data.error);
        profSelect.innerHTML += '<option value="" disabled>Erreur: ' + data.error + '</option>';
      } else {
        console.error("Format des données inattendu:", data);
        profSelect.innerHTML += '<option value="" disabled>Erreur de format de données</option>';
      }
    })
    .catch(error => {
      console.error("Erreur lors du chargement des professeurs:", error);
      profSelect.innerHTML += '<option value="" disabled>Erreur de chargement: ' + error.message + '</option>';
    });

  profSelect.addEventListener("change", () => {
    const selected = profSelect.options[profSelect.selectedIndex];
    profName.textContent = selected.textContent || "Sélectionnez un professeur";
  });

  function createExamEntry() {
    const examId = Date.now();
    const block = document.createElement("div");
    block.classList.add("exam-entry");
    block.dataset.id = examId;

    block.innerHTML = `
      <div class="exam-entry-grid">
        <div class="form-group">
          <label>Matière</label>
          <input type="text" name="matiere[]" required>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" name="date[]" required>
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" name="heure[]" required>
        </div>
        <button type="button" class="remove-exam" data-id="${examId}">
          <i class="fas fa-trash"></i> Supprimer
        </button>
      </div>
    `;

    examList.appendChild(block);

    block.querySelector(".remove-exam").addEventListener("click", () => {
      examList.removeChild(block);
    });
  }

  addExamBtn.addEventListener("click", createExamEntry);

  previewBtn.addEventListener("click", () => {
    const profNameText = profName.textContent;
    const semestre = document.getElementById("semestre").value;

    const modalContent = `
      <div class="convocation-paper">
        <div class="convocation-header">
          <img src="../src/img/usto.jpg" alt="USTO Logo" class="usto-logo" />
          <div class="convocation-texts">
            <h2 class="convocation-title">Université des sciences et de la technologie d'Oran</h2>
            <h3 class="faculty-title">Faculté des mathématiques et informatique</h3>
            <p class="ref">REF: /SURVF/MID-INF/PED/USTO/</p>
            <h3 class="convocation-heading">CONVOCATION AUX SURVEILLANCES - SESSION 1: 2023/2024</h3>
            <p class="subtitle">Licence & Master - SEMESTRE ${semestre}</p>
          </div>
        </div>
        <div class="recipient">Mme/Mlle/Mr : <strong>${profNameText}</strong></div>
        <table class="convocation-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Jour</th>
              <th>Heure</th>
              <th>Cycle</th>
              <th>Matière</th>
            </tr>
          </thead>
          <tbody id="previewTableBody"></tbody>
        </table>
      </div>
    `;

    let modal = document.getElementById("previewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "previewModal";
      modal.className = "modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        ${modalContent}
      </div>
    `;

    const tableBody = document.getElementById("previewTableBody");
    tableBody.innerHTML = "";

    document.querySelectorAll(".exam-entry").forEach(entry => {
      const date = entry.querySelector('input[name="date[]"]').value;
      const formattedDate = formatDate(date);
      const day = getDayOfWeek(date);
      const time = entry.querySelector('input[name="heure[]"]').value;
      const matiere = entry.querySelector('input[name="matiere[]"]').value;
      const semestre = document.getElementById("semestre").value;

      const row = `
        <tr>
          <td>${formattedDate}</td>
          <td>${day}</td>
          <td>${formatTime(time)}</td>
          <td>S${semestre}</td>
          <td>${matiere}</td>
        </tr>
      `;
      tableBody.insertAdjacentHTML("beforeend", row);
    });

    modal.style.display = "block";
    modal.querySelector(".close").addEventListener("click", () => {
      modal.style.display = "none";
    });
  });

  convocationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idProfesseur = profSelect.value;
    if (!idProfesseur) {
      alert("Veuillez sélectionner un professeur.");
      return;
    }

    const semestre = document.getElementById("semestre").value;

    const convocations = [];

    document.querySelectorAll(".exam-entry").forEach(entry => {
      const matiere = entry.querySelector('input[name="matiere[]"]').value;
      const date = entry.querySelector('input[name="date[]"]').value;
      const heure = entry.querySelector('input[name="heure[]"]').value;

      convocations.push({
        matiere,
        date,
        heure,
        heureFin: null,
        cycle: "S" + semestre, // Modifié pour utiliser simplement S + semestre
        semestre
      });
    });

    try {
      const res = await fetch("../db/convocation.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idProfesseur, convocations })
      });

      const result = await res.json();
      if (result.success) {
        alert("Convocation envoyée avec succès !");
        convocationForm.reset();
        profName.textContent = "Sélectionnez un professeur";
        examList.innerHTML = "";
        createExamEntry();
      } else {
        alert("Erreur : " + (result.message || result.errors?.join("\n")));
      }
    } catch (error) {
      alert("Erreur lors de l'envoi : " + error.message);
    }
  });

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }

  function getDayOfWeek(dateString) {
    if (!dateString) return '';
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const date = new Date(dateString);
    return days[date.getDay()];
  }

  function formatTime(timeString) {
    if (!timeString) return '';
    return timeString.replace(/^(\d{2}):(\d{2})$/, '$1h$2');
  }

  // Entrée initiale
  createExamEntry();
});