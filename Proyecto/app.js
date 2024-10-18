const bcrypt = require('bcrypt');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const https = require('https');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();

// Cargar los certificados SSL
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Verificar que el directorio de imágenes exista
const dir = './images';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// Conectar a la base de datos SQLite
let db = new sqlite3.Database('sql/ganado.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado a la base de datos.');
});

// Configuración de multer para manejar las imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'images/');  // Carpeta donde se almacenarán las imágenes
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Nombre único para cada archivo
    }
});
const upload = multer({ storage: storage });

// Configurar el límite de intentos
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Limitar cada IP a 5 solicitudes por ventana de 15 minutos
    message: 'Demasiados intentos de inicio de sesión, intenta de nuevo más tarde'
});

// Servir archivos estáticos (HTML, CSS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static('images'));  // Servir las imágenes almacenadas

// Ruta para manejar el login
app.post('/login', loginLimiter, 
    [
      body('username').matches(/^[a-zA-Z0-9_]+$/).withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
      body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { username, password } = req.body;
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          if (err) {
              return res.status(500).json({ error: 'Error al verificar usuario' });
          }
          if (row) {
              bcrypt.compare(password, row.password, (err, result) => {
                  if (result) {
                      res.status(200).json({ success: true });  // Login exitoso
                  } else {
                      res.status(400).json({ error: 'Contraseña incorrecta' });
                  }
              });
          } else {
              res.status(400).json({ error: 'Usuario no encontrado' });
          }
      });
  });

// Ruta para validar y registrar un nuevo usuario
app.post('/register',
    [
      body('username').notEmpty().withMessage('El nombre de usuario es obligatorio'),
      body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { username, password } = req.body;
      bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
              return res.status(500).send('Error al registrar usuario');
          }
  
          db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], (err) => {
              if (err) {
                  return res.status(500).send('Error al añadir el usuario');
              }
              res.send('Usuario registrado exitosamente');
          });
      });
  });

// Ruta para agregar un nuevo animal
app.post('/add-animal', upload.single('photo'), (req, res) => {
    const { siniiga, race, birthdate, birth_weight, father, mother } = req.body;
    const photo_path = req.file ? 'images/' + req.file.filename : null;  // Almacenar la ruta relativa

    // Validar que padre y madre no sean la misma SINIIGA
    if (father && mother && father === mother) {
        return res.status(400).send('El padre y la madre no pueden tener la misma SINIIGA.');
    }

    // Verificar si las SINIIGAs de padre y madre existen en la tabla de animales
    const checkParentsQuery = `
        SELECT siniiga FROM animals WHERE siniiga IN (?, ?)`;

    db.all(checkParentsQuery, [father, mother], (err, rows) => {
        if (err) {
            return res.status(500).send('Error al verificar las SINIIGAs de padre y madre.');
        }

        // Si alguna SINIIGA es provista, pero no se encuentra en la base de datos
        const missingParents = [];
        if (father && !rows.some(row => row.siniiga === father)) {
            missingParents.push('padre');
        }
        if (mother && !rows.some(row => row.siniiga === mother)) {
            missingParents.push('madre');
        }

        if (missingParents.length > 0) {
            return res.status(400).send(`La SINIIGA de ${missingParents.join(' y ')} no existe en la base de datos.`);
        }

        // Insertar el nuevo animal si todas las validaciones se cumplen
        db.run(
            `INSERT INTO animals (siniiga, race, birthdate, birth_weight, photo_path, father, mother)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [siniiga, race, birthdate, birth_weight, photo_path, father, mother],
            (err) => {
                if (err) {
                    return res.status(500).send('Error al añadir el animal.');
                }
                res.send('Animal añadido exitosamente');
            }
        );
    });
});

// Ruta para obtener la lista de animales
app.get('/animals', (req, res) => {
    const query = 'SELECT siniiga, race, birthdate, photo_path FROM animals';
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener la lista de animales' });
        }
        res.json(rows);
    });
});

// Ruta para buscar animales por SINIIGA
app.get('/search-animal', (req, res) => {
    const siniiga = req.query.siniiga;
    const query = 'SELECT siniiga, race, birthdate, photo_path FROM animals WHERE siniiga LIKE ?';
    db.all(query, [`%${siniiga}%`], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar animales' });
        }
        res.json(rows);
    });
});

// Servir la página de detalles del animal
app.get('/animal-details/:siniiga', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'animalDetails.html'));  // Servir el HTML
});

// API para obtener los detalles de un animal específico
app.get('/api/animal-details/:siniiga', (req, res) => {
    const siniiga = req.params.siniiga;
    
    // Consulta para obtener los detalles del animal
    const query = 'SELECT * FROM animals WHERE siniiga = ?';
    
    db.get(query, [siniiga], (err, animal) => {
        if (err) {
            return res.status(500).send({ error: 'Error al obtener los detalles del animal' });
        }

        if (!animal) {
            return res.status(404).send({ error: 'Animal no encontrado' });
        }

        // Consulta para obtener las vacunas aplicadas al animal
        const vaccineQuery = `
            SELECT v.name AS vaccine_name, va.application_date, va.ml
            FROM vaccines_applied va
            JOIN vaccine v ON va.name_vaccine = v.name
            WHERE va.siniiga = ?`;

        db.all(vaccineQuery, [siniiga], (err, vaccines) => {
            if (err) {
                return res.status(500).json({ error: 'Error al obtener las vacunas aplicadas' });
            }

            // Si no hay vacunas aplicadas, devolver una lista vacía en "vaccines"
            if (!vaccines || vaccines.length === 0) {
                vaccines = [];
            }

            // Devolver los detalles del animal y las vacunas aplicadas
            res.json({ animal, vaccines });
        });
    });
});

// Ruta para eliminar un animal
app.delete('/api/delete-animal/:siniiga', (req, res) => {
    const animalSiniiga = req.params.siniiga;

    // Consulta para eliminar el animal de la base de datos
    const query = 'DELETE FROM animals WHERE siniiga = ?';

    db.run(query, [animalSiniiga], function(err) {
        if (err) {
            return res.status(500).json({ success: false, error: 'Error al eliminar el animal' });
        }

        // Verificar si el animal fue eliminado
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Animal no encontrado' });
        }

        res.json({ success: true, message: 'Animal eliminado exitosamente' });
    });
});


// Ruta para agregar una vacuna aplicada a un animal
app.post('/add-applied-vaccine', (req, res) => {
    const { animal_siniiga, vaccine_name, dose, date_applied } = req.body;
    const query = `INSERT INTO vaccines_applied (siniiga, name_vaccine, ml, application_date) VALUES (?, ?, ?, ?)`;

    db.run(query, [animal_siniiga, vaccine_name, dose, date_applied], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Error al agregar la vacuna aplicada' });
        }
        res.json({ success: true, message: 'Vacuna aplicada agregada correctamente' });
    });
});

// Obtener todas las vacunas
app.get('/vaccines', (req, res) => {
    const query = 'SELECT name FROM vaccine';
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener vacunas' });
        }
        // Verificar que rows sea un array y tenga datos válidos
        if (!Array.isArray(rows)) {
            return res.status(500).json({ error: 'La respuesta de la base de datos no es un array' });
        }
        // Revisar si rows está vacío o contiene elementos
        if (rows.length === 0) {
            return res.status(200).json([]); // Enviar un array vacío si no hay registros
        }

        // Enviar los datos al cliente
        res.json(rows);
    });
});

// Actualizar el nombre de una vacuna
app.put('/update-vaccine', (req, res) => {
    const { oldName, newName } = req.body;
    
    // Validación de entradas
    if (!newName || newName.trim().length < 3) {
        return res.status(400).json({ error: 'El nuevo nombre de la vacuna debe tener al menos 3 caracteres' });
    }

    // Verificar si el nuevo nombre ya existe
    db.get('SELECT name FROM vaccine WHERE name = ?', [newName], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al verificar el nuevo nombre' });
        }
        if (row) {
            return res.status(400).json({ error: 'El nombre de la vacuna ya existe' });
        }

        // Actualizar el nombre de la vacuna
        const query = 'UPDATE vaccine SET name = ? WHERE name = ?';
        db.run(query, [newName, oldName], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al actualizar el nombre de la vacuna' });
            }
            res.json({ success: true, message: 'Vacuna actualizada correctamente' });
        });
    });
});

// Ruta para agregar una nueva vacuna
app.post('/add-vaccine', (req, res) => {
    const { name } = req.body;

    // Validación: nombre de la vacuna debe tener al menos 3 caracteres y no estar vacío
    if (!name || name.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'El nombre de la vacuna debe tener al menos 3 caracteres.' });
    }

    // Verificar si el nombre de la vacuna ya existe
    db.get('SELECT name FROM vaccine WHERE name = ?', [name.trim()], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Error al verificar la vacuna en la base de datos.' });
        }

        if (row) {
            // Si la vacuna ya existe, enviar mensaje adecuado
            return res.status(400).json({ success: false, error: 'El nombre de la vacuna ya existe.' });
        }

        // Si no existe, agregar la nueva vacuna
        const query = 'INSERT INTO vaccine (name) VALUES (?)';
        db.run(query, [name.trim()], function (err) {
            if (err) {
                return res.status(500).json({ success: false, error: 'Error al agregar la vacuna a la base de datos.' });
            }

            // Éxito, vacuna agregada
            return res.json({ success: true, message: 'Vacuna agregada exitosamente.' });
        });
    });
});

// Ruta para servir la página de login (login.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); // Sirve el archivo login.html
});

// Iniciar el servidor con HTTPS
https.createServer(credentials, app).listen(3000, () => {
    console.log('Servidor corriendo en el puerto 3000 con HTTPS');
});
