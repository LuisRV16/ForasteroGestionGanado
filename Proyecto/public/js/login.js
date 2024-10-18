document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();  // Evitar que el formulario recargue la página
  
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
  
        // Realiza una solicitud POST usando fetch
        fetch('https://localhost:3000/login', {  // Asegúrate de que apunte al servidor en el puerto 3000
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, password: password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = 'animals.html';  // Redirigir si el login es exitoso
            } else {
                // Mostrar el mensaje de error
                document.getElementById('error-message').textContent = data.error || 'Ocurrió un error';
            }
        })
        .catch(error => {
            document.getElementById('error-message').textContent = 'Error de conexión';
        });
    });
  });
  
  // Función para mostrar/ocultar la contraseña
  function togglePassword() {
    var passwordField = document.getElementById("password");
    if (passwordField.type === "password") {
        passwordField.type = "text";
    } else {
        passwordField.type = "password";
    }
  }
  