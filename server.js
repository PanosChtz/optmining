const express = require('express');
const app = express();
const firebase = require('firebase');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');

const coinwarz_key = '41f33775cd9549708e1fd9e363f4139d';
const coinwarz_key2 = '390c182f77b347868f47df6a71b4676d'; // second key for use during testing
const coinwarz_key3 = 'c2dcd2e34405462f8f4deffb1a27959f'; // third key for use during testing

const symbols = ['BTC', 'ETH', 'BCH', 'LTC', 'XMR', 'DASH', 'ETC', 'ZEC', 'XVG', 'DOGE', 'DGB', 'VTC']; // coin symbols list to pull data for

const fileName = 'extiprecords.txt'

function createFileIfNotExists(filename) {
  fs.open(filename, 'r', function (err, fd) {
    if (err) {
      fs.writeFile(filename, '', function (err) {
        if (err) {
          console.log(err)
        }
        // file saved
      })
    } else {
      // file exists
    }
  })
}

function getExternalIP(ip, solved) {
    const fileRecord = `${ip.toString()} ${new Date().toUTCString()} ${solved} \n`
    fs.appendFile(fileName, fileRecord, function (err) {
        if (err) throw err
        console.log('Saved!');
    });
}

createFileIfNotExists(fileName);


/* configure application configuration */
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

/* start application and initialize storage */
app.listen(5000, function () {
	init_storage();
	console.log('server application is running on port 5000');
});

/* returns json of currency data */
app.get('/api/currencies', function(req, res) {
	firebase.database().ref('/currencies').once('value').then(function(snapshot) {
  			res.json(snapshot.val());
	});
})

/* returns json of pool data */
app.get('/api/pools', function(req, res) {
	firebase.database().ref('/pools').once('value').then(function(snapshot) {
  			res.json(snapshot.val());
	});
})

/* returns json of algo data */
app.get('/api/algos', function(req, res) {
	firebase.database().ref('/algos').once('value').then(function(snapshot) {
  			res.json(snapshot.val());
	});
})

app.get('/api/forceupdate', function(req, res) {
	updateAllData();
  updateAllPrices();
  res.send("successfully updated data and prices");
})

/* pushes arguments from POST body to optimize.py and prints results */
app.post('/solve/single', function(req, res) {
  console.log('starting single curr solve...');
	var spawn = require("child_process").spawn;
  	var python = spawn('python', ["./optimize.py",
      "single",
	    req.body.pools,
	    req.body.rho,
	    req.body.R,
	    req.body.lA,
      req.body.PPS
  	]);
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  	python.stdout.on('data', function (data) {
  		var solved = data.toString()
		getExternalIP(ip, solved);
    	res.send({solved});
    	console.log({solved});
  	});
})

/* pushes arguments from POST body to optimize.py and prints results */
app.post('/solve/multicurr', function(req, res) {
  console.log('starting multi curr solve...');
	var spawn = require("child_process").spawn;
    console.log(req.body.PPS);
  	var python = spawn('python', ["./optimize.py",
      "multicurr",
	    req.body.pools,
	    req.body.rho,
	    req.body.lA,
      req.body.PPS
  	]);
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  	python.stdout.on('data', function (data) {
  		var solved = data.toString()
		getExternalIP(ip, solved);
    	res.send({solved});
    	console.log({solved});
  	});
})

/* pushes arguments from POST body to optimize.py and prints results */
app.post('/solve/multialgo', function(req, res) {
  console.log('starting multi algo solve...');
	var spawn = require("child_process").spawn;
  	var python = spawn('python', ["./optimize.py",
      "multialgo",
	    req.body.pools,
	    req.body.rho,
      req.body.PPS
  	]);
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  	python.stdout.on('data', function (data) {
  		var solved = data.toString()
		getExternalIP(ip, solved);
    	res.send({solved});
    	console.log({solved});
  	});
})

/* initializes firebase connection and updates necessary data */
function init_storage() {
	var config = {
  		apiKey: "<API_KEY>",
  		authDomain: "mineropt-f78b9.firebaseapp.com",
  		databaseURL: "https://mineropt-f78b9.firebaseio.com",
  		storageBucket: "<BUCKET>.appspot.com",
	};
	firebase.initializeApp(config);

  // update prices of currencies every 4 hours
	setInterval(updateAllPrices, 14400000);

  // update data every 3 days
  setInterval(updateAllData, 259200000);
}

function updateAllPrices() {
  for (i in symbols)
    update_price(symbols[i]);
}

function updateAllData() {
  for (i in symbols)
    update_data(symbols[i]);
}



/* updates additional data for all coins */
function update_data(symbol) {
	var ref = firebase.database().ref('currencies');
	var symbol = symbols[i];
	const coinwarz_url = "https://www.coinwarz.com/v1/api/coininformation/?apikey="+coinwarz_key+"&cointag="+symbol;
	https.get(coinwarz_url, function(res) {
	    var body = '';
		res.on('data', function(chunk){
		    body += chunk;
		});
		res.on('end', function(){
			var data = JSON.parse(body);
			if(data["Success"] == true) {
				  data = data["Data"];
		    	ref.child(symbol+'/name').set(data["CoinName"]);
          ref.child(symbol+'/algo').set(data["Algorithm"]);
          ref.child(symbol+'/block_time').set(data["BlockTimeInSeconds"]);
          ref.child(symbol+'/block_reward').set(data["BlockReward"]);
      }
		 	else { console.log('*** failed api call to coinwarz.com ***'); }
		 });
	});
}

/* updates prices for all coins */
function update_price(symbol) {
	var ref = firebase.database().ref('currencies');
	const cryptocomp_url = "https://min-api.cryptocompare.com/data/price?fsym=" + symbol +"&tsyms=BTC,USD";
	https.get(cryptocomp_url, function(res) {
	    var body = '';
		res.on('data', function(chunk){
		    body += chunk;
		});
		res.on('end', function(){
			var data = JSON.parse(body);
		    ref.child(symbol + '/prices').set({
			    BTC: data['BTC'], USD: data['USD']
			});
		});
	});
}
