document.addEventListener('DOMContentLoaded', function () {
    // ----- Código para agregar animal -----
    const animalForm = document.getElementById('addAnimalForm');
    const animalSuccessMessage = document.getElementById('animalSuccessMessage');
    const animalErrorMessage = document.getElementById('animalErrorMessage');

    if (animalForm) {
        animalForm.addEventListener('submit', function (e) {
            e.preventDefault();
    
            const photoInput = document.getElementById('photo');
            
            // Verificar si se seleccionó una imagen
            if (!photoInput.files.length) {
                animalErrorMessage.textContent = 'Debes seleccionar una imagen para el animal.';
                animalErrorMessage.classList.remove('d-none');
                animalSuccessMessage.classList.add('d-none');
                return;
            }
    
            const formData = new FormData(animalForm);
    
            fetch('/add-animal', {
                method: 'POST',
                body: formData,
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => { throw new Error(text); });
                }
                return response.text();
            })
            .then(data => {
                animalSuccessMessage.classList.remove('d-none');
                animalErrorMessage.classList.add('d-none');
                animalForm.reset();
                document.getElementById('imagePreview').innerHTML = '<span>Seleccionar Imagen</span>';
                loadAnimals(); // Actualizar la lista de animales sin recargar la página
            })
            .catch(error => {
                console.error('Error al agregar el animal:', error);
                animalSuccessMessage.classList.add('d-none');
                animalErrorMessage.classList.remove('d-none');
                animalErrorMessage.textContent = error.message; // Mostrar mensaje de error del servidor
            });
        });
    }
    
    // ----- Previsualizar imagen seleccionada -----
    function previewImage(event) {
        const input = event.target;
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = ''; // Limpiar la vista previa
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
        };

        if (file) {
            reader.readAsDataURL(file);
        }
    }

    const photoInput = document.getElementById('photo');
    if (photoInput) {
        photoInput.addEventListener('change', previewImage);
    }

    // ----- Código para gestionar vacunas -----
    const form = document.getElementById('addVaccineForm');
    const vaccineNameInput = document.getElementById('vaccineName');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    let currentEditableInput = null; // Variable para mantener el input en edición
    let originalValue = ''; // Variable para guardar el valor original

    function loadVaccines() {
        fetch('/vaccines')
            .then(response => response.json())
            .then(vaccines => {
                if (!Array.isArray(vaccines)) {
                    throw new Error('La respuesta no es un array');
                }
                const vaccineList = document.getElementById('vaccineList');
                vaccineList.innerHTML = ''; // Limpiar la lista antes de agregar las vacunas

                if (vaccines.length === 0) {
                    vaccineList.innerHTML = '<li>No hay vacunas registradas</li>';
                    return;
                }

                vaccines.forEach(vaccine => {
                    const listItem = document.createElement('li');
                    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

                    const input = document.createElement('input');
                    const button = document.createElement('button');

                    input.type = 'text';
                    input.value = vaccine.name;
                    input.className = 'form-control';
                    input.disabled = true;

                    button.textContent = 'Editar';
                    button.className = 'btn btn-primary btn-sm';

                    // Manejar el evento de clic del botón "Editar/Guardar"
                    button.addEventListener('click', function () {
                        if (input.disabled) {
                            // Si otro campo está en edición, cerrarlo primero
                            if (currentEditableInput && currentEditableInput !== input) {
                                closeEditing(currentEditableInput);
                            }

                            // Guardar el valor original antes de editar
                            originalValue = input.value;
                            input.disabled = false;
                            button.textContent = 'Guardar';
                            currentEditableInput = input; // Actualizar la referencia al campo en edición
                        } else {
                            const oldName = originalValue; // Utilizar el valor original como `oldName`
                            const newName = input.value;

                            fetch('/update-vaccine', {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ oldName, newName })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Vacuna actualizada correctamente');
                                    input.disabled = true;
                                    button.textContent = 'Editar';
                                    currentEditableInput = null; // Resetear la referencia
                                } else {
                                    alert(data.error);
                                }
                            })
                            .catch(error => {
                                console.error('Error al actualizar la vacuna:', error);
                                alert('Error al actualizar la vacuna');
                            });
                        }
                    });

                    listItem.appendChild(input);
                    listItem.appendChild(button);
                    vaccineList.appendChild(listItem);
                });
            })
            .catch(error => {
                console.error('Error al cargar las vacunas:', error);
                document.getElementById('vaccineList').innerHTML = `<li>Error al cargar las vacunas: ${error.message}</li>`;
            });
    }

    // Función para cerrar la edición de un input
    function closeEditing(input) {
        const button = input.parentElement.querySelector('button');
        input.value = originalValue; // Restaurar el valor original si no se guardó
        input.disabled = true;
        button.textContent = 'Editar';
    }

    // Detectar clic fuera del input editable para cerrar la edición
    document.addEventListener('click', function (e) {
        if (currentEditableInput && !e.target.closest('.list-group-item')) {
            closeEditing(currentEditableInput);
            currentEditableInput = null;
        }
    });

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const vaccineName = vaccineNameInput.value.trim();
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            if (vaccineName.length < 3) {
                vaccineNameInput.classList.add('is-invalid');
                submitButton.disabled = false;
                return;
            } else {
                vaccineNameInput.classList.remove('is-invalid');
            }

            fetch('/add-vaccine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: vaccineName })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    successMessage.classList.remove('d-none');
                    errorMessage.classList.add('d-none');
                    form.reset();
                    loadVaccines();
                } else {
                    successMessage.classList.add('d-none');
                    errorMessage.classList.remove('d-none');
                    errorMessage.textContent = data.error;
                }
                submitButton.disabled = false;
            })
            .catch(error => {
                console.error('Error al agregar vacuna:', error);
                successMessage.classList.add('d-none');
                errorMessage.classList.remove('d-none');
                errorMessage.textContent = 'Error al agregar la vacuna.';
                submitButton.disabled = false;
            });
        });

        // Cargar vacunas al cargar la página
        loadVaccines();
    }

    // ----- Funcionalidad para cargar y mostrar animales -----
    function loadAnimals() {
        fetch('/animals')
            .then(response => response.json())
            .then(animals => {
                const animalsList = document.getElementById('animalsList');
                animalsList.innerHTML = ''; // Limpiar lista

                if (animals.length === 0) {
                    animalsList.innerHTML = '<p>No se encontraron animales</p>';
                    return;
                }

                animals.forEach(animal => {
                    const animalCard = document.createElement('div');
                    animalCard.classList.add('card', 'mb-3', 'col-md-4');
                    animalCard.innerHTML = `
                        <img src="/${animal.photo_path}" class="card-img-top" alt="Animal Image">
                        <div class="card-body">
                            <h5 class="card-title">Siniiga: ${animal.siniiga}</h5>
                            <p class="card-text">Raza: ${animal.race}</p>
                            <p class="card-text">Fecha de Nacimiento: ${animal.birthdate}</p>
                            <a href="/animal-details/${animal.siniiga}" class="btn btn-primary">Ver más</a>
                        </div>
                    `;
                    animalsList.appendChild(animalCard);
                });
            })
            .catch(error => {
                console.error('Error al cargar animales:', error);
                document.getElementById('animalsList').innerHTML = `<p>Error al cargar los animales: ${error.message}</p>`;
            });
    }

    // Cargar la lista de animales al cargar la página
    loadAnimals();

    // ---- Funcionalidad para buscar animales por SINIIGA ----
    const searchSiniiga = document.getElementById('searchSiniiga');
    searchSiniiga.addEventListener('input', function () {
        const query = searchSiniiga.value.trim();
        fetch(`/search-animal?siniiga=${query}`)
            .then(response => response.json())
            .then(animals => {
                const animalsList = document.getElementById('animalsList');
                animalsList.innerHTML = ''; // Limpiar lista

                if (animals.length === 0) {
                    animalsList.innerHTML = '<p>No se encontraron animales</p>';
                } else {
                    animals.forEach(animal => {
                        const animalCard = document.createElement('div');
                        animalCard.classList.add('card', 'mb-3', 'col-md-4');
                        animalCard.innerHTML = `
                            <img src="/${animal.photo_path}" class="card-img-top" alt="Animal Image">
                            <div class="card-body">
                                <h5 class="card-title">Siniiga: ${animal.siniiga}</h5>
                                <p class="card-text">Raza: ${animal.race}</p>
                                <p class="card-text">Fecha de Nacimiento: ${animal.birthdate}</p>
                                <a href="/animal-details/${animal.siniiga}" class="btn btn-primary">Ver más</a>
                            </div>
                        `;
                        animalsList.appendChild(animalCard);
                    });
                }
            })
            .catch(error => {
                console.error('Error al buscar animales:', error);
            });
    });
});
