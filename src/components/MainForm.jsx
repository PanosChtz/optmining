import React, { Component } from 'react';
import Home from './Home'
import { Link } from 'react-router-dom';
import { OverlayTrigger, Tooltip, Form, FormGroup, FormControl, ControlLabel, HelpBlock, Checkbox, Button, ButtonToolbar, DropdownButton, MenuItem, Radio } from 'react-bootstrap';
import './MainForm.css';
import exec from 'child_process';
import ReactDOM from 'react-dom';

export default class MainForm extends Component {
	state = {
		currencies: {}, // all pulled currencies from API and user's entered custom currencies
		pools: {}, // all pulled pools from API and user's entered custom pools
		algos: {}, // all pulled algorithm data from API
		showCustomPoolOptions: false, // if true show options for adding a custom pool, otherwise show the "add pool" button
		showCustomCurrencyOptions: false, // if true show options for adding a custom currency, otherwise show the "add currency" button
		isMultiCurr: false, // checks if selected currencies are more than one currency
		isMultiAlgo: false // checks if selected currencies are multi-algorithm or not
	}

	convertHash(hash, cond) {
		if(hash < 0)
			hash = 0;
		else if(cond == "TH/s")
			hash *= 1000;
		else if(cond == "PH/s")
			hash *= 1000000;
		else if(cond == "EH/s")
			hash *= 1000000000;
		return hash;
	}

	/* on submit button press, call solve from api depending on selections */
	onSubmit = () => {
		var risk;
		var hash;
		var conversion;
		var pps;
		var error = false;

		/* find all selected currencies and pools */
		var pps_pool = [];
		var algos = [];
		var selected_currencies = {};
		var selected_pools = {};
		var colors = {};

		for(var n in this.state.currencies)
			if(this.state.currencies[n].checked) {
				selected_currencies[n] = this.state.currencies[n];
				colors[n] = this.state.currencies[n].color;
			}

		for(var n in this.state.pools)
			if(this.state.pools[n].checked)
					if(!this.state.pools[n].pps)
						selected_pools[n] = this.state.pools[n];
					else { // skip pps pool for now
						if(pps_pool.length == 0 || this.state.pools[pps_pool[0]].fee > this.state.pools[n].fee)
							pps_pool.push(n);
					}

		if(this.state.isMultiAlgo) {
			for(var n in this.state.currencies)
				if(this.state.currencies[n].checked && algos.indexOf(this.state.currencies[n].algo) < 0)
					algos.push(this.state.currencies[n].algo);
		}

		// calculate and check risk
		risk = ReactDOM.findDOMNode(this.refs.Risk).value.trim();
		risk = risk*0.0001;
		if(risk == 0)
			risk = 0.0000000000001;
		if(risk == "" || isNaN(risk) || risk < 0) {
			alert("Please enter a valid risk value.");
			error = true;
		}

		// calculate and check hash and conversion
		if(!this.state.isMultiAlgo) {
			hash = ReactDOM.findDOMNode(this.refs.Hash).value.trim();
			conversion = ReactDOM.findDOMNode(this.refs.Hash_Conversion).value.trim();
			if(hash == "" || isNaN(hash) || hash < 0 || hash > 99999999999) {
				alert("Please enter a valid hash power.");
				error = true;
			}
		}
		else { // multi-algorithm
			hash = {};
			conversion = {};
			for(var a in algos) {
				var hash_name = "Hash_"+algos[a];
				var conv_name = "Hash_Conversion_"+algos[a];
				hash[algos[a]] = ReactDOM.findDOMNode(this.refs[hash_name]).value.trim();
				conversion[algos[a]] = ReactDOM.findDOMNode(this.refs[conv_name]).value.trim();
				if(hash[algos[a]] == "" || isNaN(hash[algos[a]]) || hash[algos[a]] < 0 || hash[algos[a]] > 99999999999) {
					alert("Please enter a valid hash power for each algorithm.");
					error = true;
				}
			}
		}

		// convert hash / hashes if needed
		if(!this.state.isMultiAlgo)
			hash = this.convertHash(hash, ReactDOM.findDOMNode(this.refs.Hash_Conversion).value.trim());
		else
			for(var a in algos) {
				var name = "Hash_Conversion_"+algos[a];
				hash[algos[a]] = this.convertHash(hash[algos[a]], ReactDOM.findDOMNode(this.refs[name]).value.trim())
			}

		// add PPS pool last if exists
		pps = (pps_pool.length > 0);
		if(pps)
			selected_pools[n] = this.state.pools[pps_pool[0]];

		/**** send to optimize and forward results to Return.jsx **********/
		var poolData = '';
		var data = [];

		/****************************** SINGLE CURRENCY SOLVE ******************************/
		if(!this.state.isMultiCurr && !this.state.isMultiAlgo) { // single currency
				var curr = this.state.currencies[Object.keys(selected_currencies)[0]];
				var reward = curr.block_reward*curr.prices.USD;

				/* format all data arguments for optimize */
				for(var name in selected_pools)
					poolData += selected_pools[name].hash+','+selected_pools[name].fee+',';
				poolData = poolData.substring(0, poolData.length-1); // remove last ,

				for(var n in selected_pools)
					data.push({name: n});
				data.push({name: "Solo"});

				console.log(poolData);
				fetch('http://smart-miner.com:5000/solve/single', {
					method: 'POST',
					headers: {
					  'Accept': 'application/json',
					  'Content-Type': 'application/json',
					},
					body: JSON.stringify({
					  pools: poolData,
					  rho: risk, //risk aversion
					  R: reward, //block reward
					  lA: hash, //hash power
						PPS: pps // boolean if pps pool is included
					})
				})
				.then((response) => response.json())
		    .then((responseData) => {
					console.log('solved singlecurr optimization: ' + JSON.stringify(responseData));
								var conversion = ReactDOM.findDOMNode(this.refs.Hash_Conversion).value.trim();
								var hashes = this.parseResponse(responseData);

								/* maps the hash rates to their respective pools */
								var i = 0;
								while(i < hashes.length) {
									var val = hashes[i];
									if(val < 0) val = 0;
									if(conversion == "TH/s")	val /= 1000;
									else if(conversion == "PH/s") val /= 1000000;
									val = Math.round(Number(val)*100)/100;
									data[i]["Hash Power"] = val;
									i++;
								}

								/* send results graph data */
								this.props.updateResults("single", data, {"Hash Power": "#82ca9d"}, selected_currencies, selected_pools);
		    }).catch((error) => {
					console.error(error);
					alert("There was an error contacting the server. Please inform the web admin.");
				});
		}

		/****************************** MULTI CURRENCY SOLVE ******************************/
		else if(!this.state.isMultiAlgo) {
			/* format all data arguments for optimize */
			var found_currencies = [];
			for(var n in selected_pools) {
				var curr = this.state.currencies[selected_pools[n].currency];
				found_currencies.push(selected_pools[n].currency);
				poolData += selected_pools[n].hash+','+selected_pools[n].fee+','+curr.block_reward*curr.prices.USD+','+curr.block_time+','+curr.total_hash+',';
			}

			/* add fake pool for solo mine only currencies */
			var fake_pools = 0;
			for(var n in selected_currencies)
				if(found_currencies.indexOf(n) < 0) {
					var curr = this.state.currencies[n];
					poolData += 1000+','+0.99+','+curr.block_reward*curr.prices.USD+','+curr.block_time+','+curr.total_hash+',';
					fake_pools++;
				}

			poolData = poolData.substring(0, poolData.length-1); // remove last ,
			console.log(poolData);
		  fetch('http://smart-miner.com:5000/solve/multicurr', {
				method: 'POST',
				headers: {
				  'Accept': 'application/json',
				  'Content-Type': 'application/json',
				},
				body: JSON.stringify({
				  pools: poolData, //TODO FORMAT DATA FOR MULTICURR
				  rho: risk, //risk aversion
				  lA: hash, //hash power
					PPS: pps
				})
			})
			.then((response) => response.json())
	    .then((responseData) => {
							console.log('solved multicurr optimization: ' + JSON.stringify(responseData));
							var conversion = ReactDOM.findDOMNode(this.refs.Hash_Conversion).value.trim();
							var hashes = this.parseResponse(responseData);

						  /* maps the hash rates to their respective pools */
							var i = 0;
							for(var name in selected_pools) {
								data.push(this.formatData(selected_pools[name].currency, name, hashes[i], conversion));
								i++;
							}

							// skip over fake pools
							while(fake_pools > 0) {
								fake_pools--;
								i++;
							}

							/* map left over values as solos */
							for(var c in selected_currencies) {
								if(i < hashes.length) {
									data.push(this.formatData(c, 'Solo '+ c, hashes[i], conversion));
									i++;
								}
							}

							/* send results graph data */
							this.props.updateResults("multicurr", data, colors, selected_currencies, selected_pools);
	    }).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});
		}

		/****************************** MULTI ALGO SOLVE ******************************/
		else {
			/* format all data arguments for optimize */
			var found_currencies = [];
			for(var n in selected_pools) {
				var curr = this.state.currencies[selected_pools[n].currency];
				var h = hash[curr.algo];
				found_currencies.push(selected_pools[n].currency);
				poolData += selected_pools[n].hash+','+selected_pools[n].fee+','+curr.block_reward*curr.prices.USD+','+curr.block_time+','+curr.total_hash+','+h+',';
			}

			/* add fake pool for solo mine only currencies */
			var fake_pools = 0;
			for(var n in selected_currencies)
				if(found_currencies.indexOf(n) < 0) {
					var curr = this.state.currencies[n];
					var h = hash[curr.algo];
					poolData += 1000+','+0.99+','+curr.block_reward*curr.prices.USD+','+curr.block_time+','+curr.total_hash+','+h+',';
					fake_pools++;
			}

			poolData = poolData.substring(0, poolData.length-1); // remove last ,
			console.log(poolData);
			fetch('http://smart-miner.com:5000/solve/multialgo', {
				method: 'POST',
				headers: {
				  'Accept': 'application/json',
				  'Content-Type': 'application/json',
				},
				body: JSON.stringify({
				  pools: poolData, // pool data
				  rho: risk, //risk aversion
					PPS: pps
				})
			})
			.then((response) => response.json())
	    .then((responseData) => {
				console.log('solved multialgo optimization: ' + JSON.stringify(responseData));
				var hashes = this.parseResponse(responseData);

				/* finds highest conversion rate used for hash rates */
				var conversion;
				for(var a in algos) {
					var check = ReactDOM.findDOMNode(this.refs["Hash_Conversion_"+algos[a]]).value.trim();
					if(conversion == null || conversion == "GH/s")
						conversion = check;
					else if(conversion == "TH/s" && check == "PH/s")
						conversion = check;
				}

				/* maps the hash rates to their respective pools */
				var i = 0;
				for(var name in selected_pools) {
					var c = selected_pools[name].currency;
					data.push(this.formatData(c, name, hashes[i], conversion));
					i++;
				}

				// skip over fake pools
				while(fake_pools > 0) {
					fake_pools--;
					i++;
				}

				/* map left over values as solos */
				for(var c in selected_currencies) {
					if(i < hashes.length) {
						data.push(this.formatData(c, 'Solo '+c, hashes[i], conversion));
				  	i++;
					}
				}

				/* send results graph data */
				this.props.updateResults("multialgo", data, colors, selected_currencies, selected_pools);
	    }).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});
		}
	}

	/* format data returned from optimize.py into array of hash rates */
	parseResponse = (responseData) => {
		responseData = (responseData.solved).replace('[','').replace(']','').replace('\n','');
		var hashes = responseData.split(' ');
		for(var i = hashes.length - 1; i >= 0; i--)
				if(hashes[i].length < 2)
					 hashes.splice(i, 1);
		return hashes;
	}

	formatData = (curr, name, val, conversion) => {
		  if(val < 0) val = 0;
			if(conversion == "TH/s")	val /= 1000;
			else if(conversion == "PH/s") val /= 1000000;
			val = Math.round(Number(val)*100)/100;
			var d = {name:name};
			d[curr] = val;
			return d;
	}

	/* button asking to add custom pool */
	onAddPool = () => { this.setState({showCustomPoolOptions: true}) }

	/* button to add custom pool/confirm custom pool */
	onAddPoolConfirm = () => {
		var ps = this.state.pools;
		var curr = ReactDOM.findDOMNode(this.refs.Custom_Pool_Currency).value.trim();
		var name = ReactDOM.findDOMNode(this.refs.Custom_Pool_Name).value.trim();
		var hash = ReactDOM.findDOMNode(this.refs.Custom_Pool_Hash).value.trim();
		var fee = ReactDOM.findDOMNode(this.refs.Custom_Pool_Fee).value.trim()/100;
		var conversion = ReactDOM.findDOMNode(this.refs.Custom_Pool_Conversion).value.trim();
		var pps = ReactDOM.findDOMNode(this.refs.Custom_Pool_PPS).value.trim() == 'yes';

		// do error checking all inputs for custom pool
		if(name == null || name.length < 3) alert("Custom pool name must be atleast 3 characters.");
		else if(hash == "" || isNaN(hash) || hash < 0 || hash > 99999999999) alert("Please enter a valid pool hash power.");
		else if(conversion.length < 1) alert("Please select a pool hash power unit.");
		else if(curr == "") alert("Please select a currency that the pool mines.");
		else if(fee == "" || isNaN(fee) || fee < 0 || fee > 1) alert("Please enter a valid pool fee.");

		else {
			var show = this.state.currencies[curr].checked;
			name += " ("+curr+")";
			hash = this.convertHash(hash, conversion);
			ps[name] = {hash:hash, fee:fee, currency:curr, pps:pps, show:show, checked:false};
			this.setState({pools: ps});
			this.setState({showCustomPoolOptions: false});
		}
	}

	/* button to cancel adding a custom pool */
	onAddPoolCancel = () => {
		this.setState({showCustomPoolOptions: false});
	}

  /* button asking to add custom currency */
	onAddCurrency = () => { this.setState({showCustomCurrencyOptions: true}) }

	/* button to add custom pool/confirm custom pool */
	onAddCurrencyConfirm = () => {
		var cs = this.state.currencies;
		var name = ReactDOM.findDOMNode(this.refs.Custom_Currency_Name).value.trim();
		var symbol = ReactDOM.findDOMNode(this.refs.Custom_Currency_Symbol).value.trim();
		var algo = ReactDOM.findDOMNode(this.refs.Custom_Currency_Algo).value.trim();
		var price = ReactDOM.findDOMNode(this.refs.Custom_Currency_Price).value.trim();
		var reward = ReactDOM.findDOMNode(this.refs.Custom_Currency_Reward).value.trim();
		var total_hash = ReactDOM.findDOMNode(this.refs.Custom_Currency_Total_Hash).value.trim();
		var block_time = ReactDOM.findDOMNode(this.refs.Custom_Currency_Block_Time).value.trim();
		var color = ReactDOM.findDOMNode(this.refs.Custom_Currency_Color).value.trim();

		if(name == null || name.length < 3) alert("Currency name must be atleast 3 characters.");
		else if(symbol == null || symbol.length < 3 || symbol.length > 5) alert("Currency symbol must be between 3 and 5 characters.");
		else if(algo == null || algo.length < 3) alert("Please enter a valid mining algorithm.");
		else if(price == "" || isNaN(price) || price < 0) alert("Please enter a valid currency price.");
		else if(reward == "" || isNaN(reward) || reward < 0) alert("Please enter a valid currency block reward.");
		else if(total_hash == null || isNaN(total_hash) || total_hash < 0 || total_hash == 0) alert("Please enter a valid total hash rate.");
		else if(block_time == null || isNaN(block_time) || block_time < 0 || block_time == 0) alert("Please enter a valid block time.");
		else if(color == null || color.length < 4) alert("Please enter a valid hex color code");

		else {
				total_hash = this.convertHash(total_hash, ReactDOM.findDOMNode(this.refs.Custom_Currency_Conversion).value.trim());
				cs[symbol] = {name:name, prices:{USD: price}, block_reward:reward, block_time:block_time, algo:algo, total_hash:total_hash, color:color, checked:false};
				this.setState({currencies: cs});
				this.setState({showCustomCurrencyOptions: false});
		}
	}

	/* button to cancel adding a custom pool */
	onAddCurrencyCancel = () => {
		this.setState({showCustomCurrencyOptions: false});
	}

	/* a currency checkbox is toggeled */
	onCurrencyBoxChange(name) {
		return (event) => {
			var cs = this.state.currencies;
			cs[name].checked = !cs[name].checked;
			this.setState({currencies: cs});

			var isMultiA = false;
			var isMultiC = false;

			var c = 0;
			var lastAlgo = null;

			for(var n in this.state.currencies)
				if(this.state.currencies[n].checked) {
					if(lastAlgo == null) lastAlgo = this.state.currencies[n].algo;
					else if(lastAlgo != this.state.currencies[n].algo) isMultiA = true;
					c++;
				}
			if(c > 1) isMultiC = true;

			for(var n in this.state.pools)
				if(this.state.pools[n].currency == name) {
					this.state.pools[n].show = cs[name].checked;
					this.state.pools[n].checked = false;
				}
			this.setState({isMultiCurr:isMultiC, isMultiAlgo:isMultiA});
  	}
	}

	/* a pool checkbox is toggled */
	onPoolBoxChange(name) {
	    return (event) => {
				var ps = this.state.pools;
				ps[name].checked = !ps[name].checked;
				this.setState({pools: ps});
  		}
  }

	/* on initial load, load in currency and pool data from server api */
  componentDidMount() {
			/* load currency data from api into state */
  		fetch('http://smart-miner.com:5000/api/currencies')
	    .then((response) => response.json())
	    .then((responseJson) => {
	    	var cs = [];
	    	for(var name in responseJson) {
	    		cs[name] = responseJson[name];
	    		cs[name].checked = false;
	    	}
	    	this.setState({currencies: cs})
	    }).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});

			/* load pool data from api into state */
	   	fetch('http://smart-miner.com:5000/api/pools')
	    .then((response) => response.json())
	    .then((responseJson) => {
	    	var ps = [];
	    	for(var name in responseJson) {
	    		var n = name.replace("(dot)",".")
	    		ps[n] = responseJson[name];
	    		ps[n].checked = false;
					ps[n].show = false;
	    	}
	    	this.setState({pools: ps});
	    }).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});

			/* load algo data from api into state */
			fetch('http://smart-miner.com:5000/api/algos')
			.then((response) => response.json())
			.then((responseJson) => {
				this.setState({algos: responseJson});
			}).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});
  }

	/* actual rendered form */
	render() {
		// load select forms with proper elements from state
		let currency_select = [];
		for (var n in this.state.currencies)
				 currency_select.push(<option key={n} value={n}>{n}</option>);
	  let algo_select = [];
	 	for (var n in this.state.algos)
	 	 		 algo_select.push(<option key={n} value={n}>{n}</option>);

		var shown_custom_pool_component =
			<FormGroup controlId="custom_pool_elements">
				<div className='inline'>
				<div className='narrow-form3'><ControlLabel>Pool Name</ControlLabel></div>
				<div className='narrow-form1'><div className='left-margined'><ControlLabel>Fee (%)</ControlLabel></div></div>
				</div>
				<div className='inline'>
				<div className='narrow-form3'><FormControl type="text" ref="Custom_Pool_Name"/></div>
				<div className='narrow-form1'><div className='left-margined'><FormControl type="text" ref="Custom_Pool_Fee"/></div></div>
				</div><br/>

				<ControlLabel>Hash Power</ControlLabel>
				<div className='inline'>
				<div className='narrow-form3'><FormControl type="text" ref="Custom_Pool_Hash" /></div>
				<div className='hash-select'>
				<FormControl componentClass="select" placeholder="GH/s" ref="Custom_Pool_Conversion">
					<option value="GH/s">GH/s</option>
					<option value="TH/s">TH/s</option>
					<option value="PH/s">PH/s</option>
					<option value="EH/s">EH/s</option>
				</FormControl>
				</div> </div> <br />

				<div className='inline'>
				<div className='narrow-form2'><ControlLabel>Currency</ControlLabel></div>
				<div className='narrow-form1'><div className='left-margined'><ControlLabel>PPS</ControlLabel></div></div>
				</div>
				<div className='inline'>
				<div className='narrow-form2'>
				<FormControl componentClass="select" placeholder="BTC" ref="Custom_Pool_Currency">
						{currency_select}
				</FormControl>
				</div>
				<div className='hash-select'>
				<FormControl componentClass="select" placeholder='false' ref="Custom_Pool_PPS">
					<option value='no'>False</option>
					<option value='yes'>True</option>
				</FormControl>
				</div>
				</div><br/>
				<Button onClick={() => this.onAddPoolConfirm()}> Add Pool</Button>
				<Button onClick={() => this.onAddPoolCancel()}> Cancel</Button>
			</FormGroup>
		var hidden_custom_pool_component =
		<FormGroup>
		<OverlayTrigger trigger="hover" placement="top" overlay=<Tooltip>add a custom pool</Tooltip>>
		<Button onClick={() => this.onAddPool()}> Add Pool</Button>
		</OverlayTrigger>
		</FormGroup>

		/* add pool element to add new pool */
		var add_pool_component = hidden_custom_pool_component;
		if(this.state.showCustomPoolOptions)
			add_pool_component = shown_custom_pool_component;

		var shown_custom_currency_component =
				<FormGroup controlId="custom_pool_elements">
					<div className='inline'>
					<div className='narrow-form3'><ControlLabel>Currency Name</ControlLabel></div>
					<div className='narrow-form2'> <div className='left-margined'> <ControlLabel>Symbol</ControlLabel> </div> </div>
					</div>
					<div className='inline'>
					<div className='narrow-form3'> <FormControl type="text" ref="Custom_Currency_Name"/></div>
					<div className='narrow-form1'> <div className='left-margined'> <FormControl type="text" ref="Custom_Currency_Symbol"/></div></div>
					</div> <br/>
					<div className='inline'>
					<div className='narrow-form3'><ControlLabel>Price (USD)</ControlLabel></div>
					<OverlayTrigger trigger="hover" placement="top" overlay=<Tooltip>coins rewarded per block</Tooltip>>
					<div className='narrow-form2'> <div className='left-margined'> <ControlLabel>Reward (Coins)</ControlLabel> </div> </div>
					</OverlayTrigger>
					</div>
					<div className='inline'>
					<div className='narrow-form3'> <FormControl type="text" ref="Custom_Currency_Price"/></div>
					<div className='narrow-form1'> <div className='left-margined'> <FormControl type="text" ref="Custom_Currency_Reward"/></div></div>
					</div><br/>

					<div className='inline'>
					<div className='narrow-form3'><ControlLabel>Mining Algorithm</ControlLabel></div>
					<div className='left-margined'><div className='narrow-form1'><ControlLabel>Block Time (secs)</ControlLabel></div></div>
					</div>
					<div className='inline'>
					<div className='narrow-form3'><FormControl componentClass="select" placeholder="SHA-256" ref="Custom_Currency_Algo">
										{algo_select}
					</FormControl></div>
					<div className='narrow-form1'><div className='left-margined'><FormControl type="text" ref="Custom_Currency_Block_Time"/></div></div>
					</div><br/>

					<div className='narrow-form3'><ControlLabel>Currency Total Hash Rate</ControlLabel></div>
					<div className='inline'>
					<div className='narrow-form3'><FormControl type="text" ref="Custom_Currency_Total_Hash" /></div>
					<div className='hash-select'>
					<FormControl componentClass="select" placeholder="GH/s" ref="Custom_Currency_Conversion">
						<option value="GH/s">GH/s</option>
						<option value="TH/s">TH/s</option>
						<option value="PH/s">PH/s</option>
						<option value="EH/s">EH/s</option>
					</FormControl>
					</div> </div> <br />

					<div className='narrow-form1'><ControlLabel>Currency Color</ControlLabel></div>
					<div className='narrow-form1'>
					<FormControl componentClass="select" placeholder="GH/s" ref="Custom_Currency_Color">
						<option value="#100c08">Black</option>
					  <option value="#4682b4">Blue</option>
						<option value="#a67b5b">Brown</option>
						<option value="#b1b3b0">Gray</option>
						<option value="#2bd849">Green</option>
						<option value="#ed872d">Orange</option>
						<option value="#ff9ecb">Pink</option>
						<option value="#8a2be2">Purple</option>
						<option value="#cf0000">Red</option>
						<option value="#eff676">Yellow</option>
					</FormControl>
					</div><br/>

					<Button onClick={() => this.onAddCurrencyConfirm()}> Add Currency</Button>
					<Button onClick={() => this.onAddCurrencyCancel()}> Cancel</Button>
				</FormGroup>
		var hidden_custom_currency_component =
		<FormGroup>
		<OverlayTrigger trigger="hover" placement="top" overlay=<Tooltip>add a custom currency</Tooltip>>
		<Button onClick={() => this.onAddCurrency()}> Add Currency</Button>
		</OverlayTrigger>
		</FormGroup>

		var hash_component = [];
		if(!this.state.isMultiAlgo) {
			hash_component =
								<FormGroup>
				          <ControlLabel>Your Hash Power</ControlLabel>
									<div className='inline'>
				          <div className='narrow-form3'> <FormControl inline type="text" ref="Hash"/></div>
									<div className='hash-select'>
									<FormControl componentClass="select" placeholder="GH/s" ref="Hash_Conversion">
										<option value="GH/s">GH/s</option>
										<option value="TH/s">TH/s</option>
										<option value="PH/s">PH/s</option>
									</FormControl>
									</div> </div>
				          <HelpBlock>Your total mining hash power.</HelpBlock>
				        </FormGroup>
		}
		else {
			var algos = [];
			for(var n in this.state.currencies)
				if(this.state.currencies[n].checked && algos.indexOf(this.state.currencies[n].algo) < 0)
					algos.push(this.state.currencies[n].algo);

			for(var a in algos) {
				var name = "Hash_"+algos[a];
				var conversion = "Hash_Conversion_"+algos[a];
				hash_component.push(
													<FormGroup>
								          <ControlLabel>Your Hash Power for {algos[a]}</ControlLabel>
													<div className='inline'>
								          <div className='narrow-form3'> <FormControl inline type="text" ref={name}/></div>
													<div className='hash-select'>
													<FormControl componentClass="select" placeholder="GH/s" ref={conversion}> //TODO ON CHANGE METHOD
														<option value="GH/s">GH/s</option>
														<option value="TH/s">TH/s</option>
														<option value="PH/s">PH/s</option>
													</FormControl>
													</div> </div>
								          <HelpBlock>Your mining hash power for {algos[a]}.</HelpBlock>
								        </FormGroup>)
			}
		}


		var add_currency_component = hidden_custom_currency_component;
		if(this.state.showCustomCurrencyOptions)
			add_currency_component = shown_custom_currency_component;
  	var cnt1 = 0;
		var currency_boxes = [];
		for(var name in this.state.currencies) {
			currency_boxes.push(
			<>
			<Checkbox inline
			  		id = {name}
	          checked = {this.state.currencies[name].checked}
	          onChange = {this.onCurrencyBoxChange(name)}
	    > {name} </Checkbox>
			</>
			);
      cnt1++;
     	if(cnt1 == 5) { currency_boxes.push(<><br/></>); cnt1 = 0; } // move to new line after 5 elements for formatting
		}
		var cnt2 = 0;
		var pool_boxes = [];
		for(var name in this.state.pools) {
			if(this.state.pools[name].show == true) {
				pool_boxes.push(
				<> <Checkbox inline
				  		id = {name}
		          checked = {this.state.pools[name].checked}
		          onChange = {this.onPoolBoxChange(name)}
		    > {name} </Checkbox></>);
		    cnt2++;
			}
	    if(cnt2 == 2) { pool_boxes.push(<><br/></>); cnt2 = 0; } // move to new line after 3 elements for formatting
		}

	 	return (
	      <form>
	      	<ControlLabel>Currencies</ControlLabel>
	        <FormGroup controlId="currencies"> <tbody>{currency_boxes}</tbody> </FormGroup>

					{add_currency_component}

	        <ControlLabel>Mining Pools</ControlLabel>
	        <FormGroup controlId="pools"> <tbody>{pool_boxes}</tbody> </FormGroup>

	        {add_pool_component}

					{hash_component}

	        <FormGroup>
					<OverlayTrigger trigger="hover" placement="top" overlay=<Tooltip>risk factor of inconsistent reward</Tooltip>>
					<div className='narrow-form2'> <ControlLabel>Risk Aversion</ControlLabel></div>
					</OverlayTrigger>
	          <div className='narrow-form2'> <FormControl type="text" ref="Risk"/></div>
	          <HelpBlock>Suggested range 1-10.</HelpBlock>
	        </FormGroup>

	        <Button onClick={() => this.onSubmit()}> Submit </Button>
	       </form>
	    );
	}
}
