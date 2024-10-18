document.addEventListener('DOMContentLoaded', function () {
    // Obtener SINIIGA desde la URL como parte del path
    const animalSiniiga = window.location.pathname.split('/').pop();

    if (animalSiniiga) {
        loadAnimalDetails(animalSiniiga);
    } else {
        console.error('El parámetro SINIIGA no está presente en la URL.');
    }

    // Función para cargar los detalles del animal
    function loadAnimalDetails() {
        fetch(`/api/animal-details/${animalSiniiga}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('animalSiniiga').textContent = data.animal.siniiga;
                document.getElementById('animalRace').textContent = data.animal.race;
                document.getElementById('animalBirthDate').textContent = data.animal.birthdate;
                document.getElementById('animalWeight').textContent = data.animal.birth_weight;
                document.getElementById('animalFather').textContent = data.animal.father || 'N/A';
                document.getElementById('animalMother').textContent = data.animal.mother || 'N/A';
                document.getElementById('animalImage').src = `/${data.animal.photo_path}`;

                // Cargar las vacunas aplicadas
                const vaccinesTable = document.getElementById('vaccinesTable');
                vaccinesTable.innerHTML = '';
                if (data.vaccines.length > 0) {
                    data.vaccines.forEach(vaccine => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${vaccine.vaccine_name}</td>
                            <td>${vaccine.ml}</td>
                            <td>${vaccine.application_date}</td>
                        `;
                        vaccinesTable.appendChild(row);
                    });
                } else {
                    vaccinesTable.innerHTML = '<tr><td colspan="3">No hay vacunas aplicadas</td></tr>';
                }
            })
            .catch(error => {
                console.error('Error al cargar los detalles del animal:', error);
            });
    }

    // Mostrar formulario para añadir nueva vacuna
    const addNewVaccineBtn = document.getElementById('addNewVaccineBtn');
    const addVaccineFormContainer = document.getElementById('addVaccineFormContainer');
    const cancelAddVaccine = document.getElementById('cancelAddVaccine');
    const addVaccineForm = document.getElementById('addVaccineForm');

    if (addNewVaccineBtn) {
        addNewVaccineBtn.addEventListener('click', () => {
            addVaccineFormContainer.classList.remove('d-none');
        });
    }

    cancelAddVaccine.addEventListener('click', () => {
        addVaccineFormContainer.classList.add('d-none');
        addVaccineForm.reset();
    });

    // Cargar vacunas disponibles en el desplegable
    function loadAvailableVaccines() {
        fetch('/vaccines')
            .then(response => response.json())
            .then(vaccines => {
                const vaccineSelect = document.getElementById('vaccineSelect');
                vaccineSelect.innerHTML = '';
                vaccines.forEach(vaccine => {
                    const option = document.createElement('option');
                    option.value = vaccine.name;
                    option.textContent = vaccine.name;
                    vaccineSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error al cargar las vacunas disponibles:', error);
            });
    }

    // Escuchar el evento de formulario para añadir nueva vacuna aplicada
    if (addVaccineForm) {
        addVaccineForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const vaccine_name = document.getElementById('vaccineSelect').value;
            const dose = document.getElementById('dose').value;
            const date_applied = document.getElementById('dateApplied').value;

            const data = { animal_siniiga: animalSiniiga, vaccine_name, dose, date_applied };

            fetch('/add-applied-vaccine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('Vacuna aplicada con éxito');
                    loadAnimalDetails(animalSiniiga); // Recargar detalles del animal
                    addVaccineForm.reset(); // Limpiar el formulario
                } else {
                    alert('Error al aplicar la vacuna');
                }
            })
            .catch(error => {
                console.error('Error al agregar la vacuna aplicada:', error);
            });
        });
    }

    // Funcionalidad para eliminar el animal
    const deleteAnimalBtn = document.getElementById('deleteAnimalBtn');
    if (deleteAnimalBtn) {
        deleteAnimalBtn.addEventListener('click', function () {
            if (confirm('¿Estás seguro de que deseas eliminar este animal? Esta acción no se puede deshacer.')) {
                fetch(`/api/delete-animal/${animalSiniiga}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('No se pudo eliminar el animal. Status: ' + response.status);
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.success) {
                        alert('Animal eliminado con éxito');
                        window.location.href = '/animals.html'; // Redirigir a la página de lista de animales
                    } else {
                        alert('Error al eliminar el animal: ' + result.error);
                    }
                })
                .catch(error => {
                    console.error('Error al eliminar el animal:', error);
                    alert('Error al eliminar el animal: ' + error.message);
                });
            }
        });
        
    }

    // Cargar los detalles del animal y las vacunas disponibles
    loadAvailableVaccines();
});
