const http = require('http');
const { resolve } = require('path');
const { Client } = require('pg');
var qs = require('querystring');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'karte',
  password: 'lozinka123',
  port: 5432,
});

client.connect();
const PORT = 8000;

const server = http.createServer((req, res) => {
  if (req.method == 'POST') {
    var body = '';

    req.on('data', function (data) {
      console.log(data);
      body += data;
    });

    req.on('end', function (data) {
      var post = qs.parse(body);
      client
        .query(
          `INSERT INTO "Lokacije" ("long", "lat", "Ime i prezime", "Datum") VALUES (${post['lng']}, ${post['lat']},'${post['namesurname']}', '${post['datum']}');`
        )
        .then((_) => {
          client
            .query(
              `INSERT INTO "Lokacije_geom" ("geom", "Ime i prezime", "Datum") VALUES (ST_PointFromText('POINT(${post['lng']} ${post['lat']})', 4326), '${post['namesurname']}', '${post['datum']}');`
            )
            .then((_) => {
              client.query('SELECT * FROM "Lokacije"').then((podaci) => {
                client
                  .query(
                    `SELECT "mjesta".name_2 AS NazivGrada,
            "Lokacije_geom"."Ime i prezime" AS ImeIPrezime FROM "mjesta", "Lokacije_geom" 
            WHERE ST_Contains("mjesta".geom,"Lokacije_geom".geom);`
                  )
                  .then((podaci_ljudi_u_zupaniji) => {
                    client
                      .query(
                        `SELECT COUNT(*) AS BrojLjudi, NazivGrada FROM (
                          SELECT "mjesta".name_2 AS NazivGrada
                          FROM "mjesta", "Lokacije_geom" 
                          WHERE ST_Contains("mjesta".geom,"Lokacije_geom".geom)
                          AND "Datum" BETWEEN '2022-02-01' AND '2022-02-28'
                      ) as Povrat GROUP BY NazivGrada;`
                      )
                      .then((podaci_broj_ljudi_u_zupaniji) => {
                        res.setHeader('Content-Type', 'text/html');

                        res.write(KreirajZaglavljePocetne());
                        res.write('<body>');
                        res.write(DodajMapu());

                        res.write(`
                        <h2>Unos lokacije korisnika</h2>
                        <form action="/" method="POST">
          
                        <div class="container">
          
                        <div class="labela">
                          <label for="lat">Latitude:  </label>
                          <input type="text" id="lat" name="lat" readonly required><br>
                        </div>
                        
                        <div class="labela">
                          <label for="lng">Longitude:  </label>
                          <input type="text" id="lng" name="lng" readonly required><br>
                        </div>
          
                        
                        <div class="labela">
                          <label for="namesurname">Ime i prezime korisnika:  </label>
                          <input type="text" id="namesurname" name="namesurname" required>
                        </div>

                        <div class="labela">
                          <label for="datum">Datum:  </label>
                          <input type="date" id="datum" name="datum" required>
                        </div>
          
                        </div>
                        
                        <br>
                        
                        <div class="submit">
                          <input type="submit" value="Unesi lokaciju korisnika">
                        </div>
                        </form>
          
                        <div class="button-container">
                          <button type="button" class="gumb-prikazi-tablicu" onclick="ToggleTablicuBrojLjudiPoZupanijama()">Tablica broja <br> korisnika po gradovima</button>
                        </div>
              
              `);

                        res.write(`
              <div id="broj-ljudi-u-zupaniji" class="sakrij" style="padding-left: 20px;">
              <h2>Broj ljudi po gradovima</h2>
              <table>
                  <tr>
                  <th>Grad</th>
                  <th>Broj ljudi</th>
                  </tr>`);
                        for (
                          let b = 0;
                          b < podaci_broj_ljudi_u_zupaniji['rows'].length;
                          b++
                        ) {
                          let br = podaci_broj_ljudi_u_zupaniji['rows'][b];

                          res.write(`
                  <tr>
                  <td>${br['nazivgrada']}</td>
                  <td>${br['brojljudi']}</td>
                  </tr>
                  `);
                        }
                        res.write(`</table>
              </div>`);

                        res.write(`
              <div id="popis-korisnika-i-zupanija" class="sakrij" style="padding-left: 20px;">
              <br><br><br>
              <h2>Popis korisnika i njihov trenutni grad</h2>
              <table>
                  <tr>
                  <th>Korisnik</th>
                  <th>Grad</th>
                  </tr>`);

                        for (
                          let k = 0;
                          k < podaci_ljudi_u_zupaniji['rows'].length;
                          k++
                        ) {
                          let kor = podaci_ljudi_u_zupaniji['rows'][k];
                          res.write(`
                  <tr>
                  <td>${kor['imeiprezime']}</td>
                  <td>${kor['nazivgrada']}</td>
              </tr>
                  `);
                        }

                        res.write(`</table></div>
              <br><br><br><br>`);

                        res.write(`<script>
              function initMap() {
                  map = new google.maps.Map(document.querySelector("#map"), {
                  center: new google.maps.LatLng(44.7737849,16.4688717),
                  zoom: 7,
                  mapTypeId: "hybrid",
                  });
                  
                  let marker = new google.maps.Marker({
                    position: {lat: 0, lng: 0},
                    icon: "https://maps.google.com/mapfiles/kml/pushpin/purple-pushpin.png",
                    map,
                    title: "Kliknuta lokacija"
                  });


                  map.addListener("click", (mapMouseEvent) => {
                    let koordinate = mapMouseEvent.latLng.toJSON();
                    marker.setPosition(mapMouseEvent.latLng);
                    document.getElementById("lat").value = koordinate.lat;
                    document.getElementById("lng").value = koordinate.lng;
                  });
                  
                  
                  `);

                        for (let p = 0; p < podaci['rows'].length; p++) {
                          let poz = podaci['rows'][p];
                          let koordinate = {
                            lat: poz['lat'],
                            lng: poz['long'],
                          };

                          res.write(`new google.maps.Marker({
                  position: {lat:${koordinate['lat']},lng:${koordinate['lng']}},
                  map,
                  title: "${poz['Ime i prezime']}",
                  });
          
                  `);
                        }

                        res.write(`
              }
              </script>`);
                        res.write(DodajFunkcijePrikazaTablica());
                        res.write(DodajMapuScript());
                        res.write('</body>');
                        res.end();
                      });
                  });
              });
            });
        });
    });
  } else {
    client.query('SELECT * FROM "Lokacije"').then((podaci) => {
      client
        .query(
          `SELECT "mjesta".name_2 AS NazivGrada,
          "Lokacije_geom"."Ime i prezime" AS ImeIPrezime FROM "mjesta", "Lokacije_geom" 
          WHERE ST_Contains("mjesta".geom,"Lokacije_geom".geom);`
        )
        .then((podaci_ljudi_u_zupaniji) => {
          client
            .query(
              `SELECT COUNT(*) AS BrojLjudi, NazivGrada FROM (
                SELECT "mjesta".name_2 AS NazivGrada
                FROM "mjesta", "Lokacije_geom" 
                WHERE ST_Contains("mjesta".geom,"Lokacije_geom".geom)
            ) as Povrat GROUP BY NazivGrada;`
            )
            .then((podaci_broj_ljudi_u_zupaniji) => {
              res.setHeader('Content-Type', 'text/html');

              res.write(KreirajZaglavljePocetne());
              res.write('<body>');
              res.write(DodajMapu());

              res.write(`
              <h2>Unos lokacije korisnika</h2>
              <form action="/" method="POST">

              <div class="container">

              <div class="labela">
                <label for="lat">Latitude:  </label>
                <input type="text" id="lat" name="lat" readonly required><br>
              </div>
              
              <div class="labela">
                <label for="lng">Longitude:  </label>
                <input type="text" id="lng" name="lng" readonly required><br>
              </div>

              
              <div class="labela">
                <label for="namesurname">Ime i prezime korisnika:  </label>
                <input type="text" id="namesurname" name="namesurname" required>
              </div>

              <div class="labela">
                          <label for="datum">Datum:  </label>
                          <input type="date" id="datum" name="datum" required>
                        </div>

              </div>
              
              <br>
              
              <div class="submit">
                <input type="submit" value="Unesi lokaciju korisnika">
              </div>
              </form>

              <div class="button-container">
                <button type="button" class="gumb-prikazi-tablicu" onclick="ToggleTablicuBrojLjudiPoZupanijama()">Tablica broja <br> korisnika po gradovima</button>
              </div>
              
              `);

              res.write(`
              <div id="broj-ljudi-u-zupaniji" class="sakrij" style="padding-left: 20px;">
              <h2>Broj ljudi po županijama</h2>
              <table>
                  <tr>
                  <th>Grad</th>
                  <th>Broj ljudi</th>
                  </tr>`);
              for (
                let b = 0;
                b < podaci_broj_ljudi_u_zupaniji['rows'].length;
                b++
              ) {
                let br = podaci_broj_ljudi_u_zupaniji['rows'][b];

                res.write(`
                  <tr>
                  <td>${br['nazivgrada']}</td>
                  <td>${br['brojljudi']}</td>
                  </tr>
                  `);
              }
              res.write(`</table>
              </div>`);

              res.write(`
              <div id="popis-korisnika-i-zupanija" class="sakrij" style="padding-left: 20px;">
              <br><br><br>
              <h2>Popis korisnika i njihova trenutna županija</h2>
              <table>
                  <tr>
                  <th>Korisnik</th>
                  <th>Grad</th>
                  </tr>`);

              for (let k = 0; k < podaci_ljudi_u_zupaniji['rows'].length; k++) {
                let kor = podaci_ljudi_u_zupaniji['rows'][k];
                res.write(`
                  <tr>
                  <td>${kor['imeiprezime']}</td>
                  <td>${kor['nazivgrada']}</td>
              </tr>
                  `);
              }

              res.write(`</table></div>
              <br><br><br><br>`);

              res.write(`<script>
              function initMap() {
                  map = new google.maps.Map(document.querySelector("#map"), {
                  center: new google.maps.LatLng(44.7737849,16.4688717),
                  zoom: 7,
                  mapTypeId: "hybrid",
                  });
                  
                  
                  let marker = new google.maps.Marker({
                    position: {lat: 0, lng: 0},
                    icon: "https://maps.google.com/mapfiles/kml/pushpin/purple-pushpin.png",
                    map,
                    title: "Kliknuta lokacija"
                  });


                  map.addListener("click", (mapMouseEvent) => {
                    let koordinate = mapMouseEvent.latLng.toJSON();
                    marker.setPosition(mapMouseEvent.latLng);
                    document.getElementById("lat").value = koordinate.lat;
                    document.getElementById("lng").value = koordinate.lng;
                  });
                  
                  
                  `);

              for (let p = 0; p < podaci['rows'].length; p++) {
                let poz = podaci['rows'][p];
                let koordinate = { lat: poz['lat'], lng: poz['long'] };

                res.write(`new google.maps.Marker({
                  position: {lat:${koordinate['lat']},lng:${koordinate['lng']}},
                  map,
                  title: "${poz['Ime i prezime']}",
                  });
          
                  `);
              }

              res.write(`
              }
              </script>`);
              res.write(DodajFunkcijePrikazaTablica());
              res.write(DodajMapuScript());
              res.write('</body>');
              res.end();
            });
        });
    });
  }
});

server.listen(PORT, 'localhost', () => {
  console.group('slušam nova povezivanja...');
});

function KreirajZaglavljePocetne() {
  return `
      <head>
        <title>Posjećene lokacije</title>
        <meta charset="UTF-8">
        <script src="https://polyfill.io/v3/polyfill.min.js?features=default"></script>
        
        <style>
        
        #map {
          height: 80%;
        }

        body{
          background: #161716;
          color: white;
        }
  
        * {
          font-family: Helvetica, arial, sans-serif;
          margin: 0;
          padding: 0;
        }

        table {
          margin-top:30px;
          font-family: arial, sans-serif;
          border-collapse: collapse;
          width: 40%;
        }
        
        td, th {
          border: 1px solid #dddddd;
          text-align: left;
          padding: 8px;
        }

        th{
          text-transform: uppercase;
          background: #495867;
        }
        
        tr:nth-child(even) {
          background-color: #dddddd;
          color: #000000;
        }


        form {
          padding: 1rem;
          font-size:16px;
        }

        h2 {
          padding-left: 15px;
          margin-top: 5rem;
          text-align: center;
          text-transform: uppercase;
        }


        .labela {
          text-align: left;
          margin: 12px;
          padding-left: 15px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: space-between;
          width: 20rem;
        }

        .container{
          display: flex;
          justify-content: space-evenly;
        }

        .button-container{
          display: flex;
          justify-content: space-evenly;
          flex-direction: column;
          gap: 2rem;
        }

        table{
          margin: auto;
          margin-top: 5rem;
        }


        .submit {
          text-align: left;
          margin: 12px;
          padding-left: 15px;
          display: flex;
          justify-content: center;
        }

        input[type=text] {
          border: none;
          border-bottom: 1px solid black;
          border-radius: 5px;
          padding: 0.5rem;
        }

        input[type=submit] {
          border: none;
          color: black;
          background-color: white;
          border-radius: 7px;
          font-size: 16px;
          padding: 5px;
          margin: 10px;
          text-transform: uppercase;
          padding: 1rem;
        }

        button{
          text-transform: uppercase;
          font-size: 1rem;
          padding: 0.5rem;
          border-radius: 10px;
          line-height: 1.5;
          margin: auto;
          width: 20rem;
        }

        .sakrij {
          display: none;
        }

        .prikazi {
          display: block;
        }

        </style>
  
       </head>
    `;
}

function DodajMapu() {
  return `
    <div id="map"></div>
    `;
}

function DodajFunkcijePrikazaTablica() {
  return `
      <script>

      function ToggleTablicuBrojLjudiPoZupanijama() {
        let tablica = document.getElementById("broj-ljudi-u-zupaniji");
        if(tablica.classList.contains("sakrij")){
          tablica.classList.remove("sakrij");
          tablica.classList.add("prikazi");
          return;
        }

        if(tablica.classList.contains("prikazi")){
          tablica.classList.remove("prikazi");
          tablica.classList.add("sakrij");
          return;
        }
      }
      
      </script>
    `;
}

function DodajMapuScript() {
  return `
    </script>
      <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyArKtBtn47SszkulwFNqsDslDmiIv_LF7o&callback=initMap" async defer>
      </script>
    `;
}
