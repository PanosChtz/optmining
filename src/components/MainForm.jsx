import React, { Component } from 'react';
import Home from './Home'
import { Link } from 'react-router-dom';
import { Form, FormGroup, FormControl, ControlLabel, HelpBlock, Checkbox, Button, ButtonToolbar, DropdownButton, MenuItem, Radio } from 'react-bootstrap';
import './MainForm.css';
import exec from 'child_process';
import ReactDOM from 'react-dom';

export default class MainForm extends Component {
	colors = {"BTC": "#82ca9d", "BCH":"#ffcc00", "DASH":"#80bfff"}; //TODO REMOVE, ADD TO COLORS

	state = {
		currencies: {}, // all pulled currencies from API and user's entered custom currencies
		pools: {}, // all pulled pools from API and user's entered custom pools
		algos: {}, // all pulled algorithm data from API
		hash: "", // the user's entered hash rate, tied with conversion
		conversion: "GH/s", // conversion rate for user's entered hash rate
		customPoolConversion: "GH/s", // custom pool conversion rate of pool user is currently adding
		customPoolCurrency: "BTC",
		customCurrencyAlgo: "SHA-256",
		risk: "", // risk aversion factor entered by user
		showCustomPoolOptions: false, // if true show options for adding a custom pool, otherwise show the "add pool" button
		showCustomCurrencyOptions: false // if true show options for adding a custom currency, otherwise show the "add currency" button
	}

	/* on submit button press, call solve from api depending on selections */
	onSubmit = () => {
		/* find all selected currencies and pools */
		var selected_currencies = {};
		var selected_pools = {};
		for(var n in this.state.currencies)
			if(this.state.currencies[n].checked)
				selected_currencies[n] = this.state.currencies[n];
		for(var n in this.state.pools)
			if(this.state.pools[n].checked)
					selected_pools[n] = this.state.pools[n];

		var risk = ReactDOM.findDOMNode(this.refs.Risk).value.trim();
		var hash = ReactDOM.findDOMNode(this.refs.Hash).value.trim();

		// validate all inputs
		if(JSON.stringify(selected_currencies) == JSON.stringify({}))
			alert("Please select atleast one cryptocurrency.");
		else if(JSON.stringify(selected_pools) == JSON.stringify({}))
			alert("Please select atleast one mining pool.");
		else if(hash == "" || isNaN(hash) || hash < 0 || hash > 99999999999)
			alert("Please enter a valid hash power.");
		else if(this.state.conversion.length < 2)
			alert("Please select a hash power unit.");
		else if(risk == "" || isNaN(risk) || risk < 0)
			alert("Please enter a valid risk.");

		/**** send to optimize and forward results to Return.jsx **********/
		else {
				// temp, sets first selected_currencies to greater than 0
				var reward = selected_currencies[Object.keys(selected_currencies)[0]].block_reward * selected_currencies[Object.keys(selected_currencies)[0]].prices.USD;
				risk = risk*0.0001;
				// convert hashrate if needed
				if(this.state.conversion == "TH/s")
					hash *= 1000;
				else if(this.state.conversion == "PH/s")
					hash *= 1000000;

				var poolData = '';
				const data = [];

				/** SINGLE CURRENCY SOLVE **/
				if(Object.keys(selected_currencies).length == 1) { // single currency
						/* format all data arguments for optimize */
						for(var n in selected_pools)
							poolData += selected_pools[n].hash+','+selected_pools[n].fee+',';
						poolData = poolData.substring(0, poolData.length-1); // remove last ,
						for(var n in selected_pools)
							data.push({name: n});
						data.push({name: "Solo"});
						/* call single currency solve with arguments */
						fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/solve/single', {
							method: 'POST',
							headers: {
							  'Accept': 'application/json',
							  'Content-Type': 'application/json',
							},
							body: JSON.stringify({
							  pools: poolData,
							  rho: risk, //risk aversion
							  R: reward, //block reward
							  lA: hash //hash power
							})
						})
						.then((response) => response.json())
				    .then((responseData) => {
										/* format data returned from optimize.py into array of hash rates */
										responseData = (responseData.solved).replace('[','').replace(']','');
										var hashes = responseData.split(' ');
										for(var i = hashes.length - 1; i >= 0; i--)
										    if(hashes[i].length < 2)
										       hashes.splice(i, 1);
										/* maps the hash rates to their respective pools */
										var i = 0;
										while(i < hashes.length) {
											var n = hashes[i];
											// convert hash rate if needed
											if(n < 0) n = 0;
											if(this.state.conversion == "TH/s")	n /= 1000;
											else if(this.state.conversion == "PH/s") n /= 1000000;
											n = Math.round(Number(n)*100)/100;
											data[i]["Hash Power"] = n;
											i++;
										}
										/* updates results graph data */
										this.props.updateResults("single", data, {"Hash Power": "#82ca9d"}, selected_currencies, selected_pools);
				    }).catch((error) => {
							console.error(error);
							alert("There was an error contacting the server. Please inform the web admin.");
						});
				}

				/** MULTICURRENCY SOLVE **/
				else { // multiple currencies to process
						var lastAlgo = "";
						var multiAlgo = false;
						for(var n in selected_currencies) {
							if(lastAlgo == "")
								lastAlgo = selected_currencies[n].algo;
							else if(selected_currencies[n].algo.toUpperCase() != lastAlgo) {
								multiAlgo = true;
								break;
							}
						}

						if(!multiAlgo) { // use multiple currency call and formatting
							/* format all data arguments for optimize */
							for(var n in selected_pools) {
								var curr = selected_pools[n].currency;
								var block_reward = this.state.currencies[curr].block_reward*this.state.currencies[curr].prices.USD;
								var block_time = this.state.currencies[curr].block_time;
								var total_hash = this.state.currencies[curr].total_hash;
								poolData += selected_pools[n].hash+','+selected_pools[n].fee+','+block_reward+','+block_time+','+total_hash+',';
							}
							poolData = poolData.substring(0, poolData.length-1); // remove last ,

							console.log(poolData);
							fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/solve/multicurr', {
								method: 'POST',
								headers: {
								  'Accept': 'application/json',
								  'Content-Type': 'application/json',
								},
								body: JSON.stringify({
								  pools: poolData, //TODO FORMAT DATA FOR MULTICURR
								  rho: risk, //risk aversion
								  lA: hash //hash power
								})
							})
							.then((response) => response.json())
					    .then((responseData) => {
											console.log(responseData);
											responseData = (responseData.solved).replace('[','').replace(']','');
											var hashes = responseData.split(' ');
											for(var i = hashes.length - 1; i >= 0; i--)
													if(hashes[i].length < 2)
														 hashes.splice(i, 1);

											var i = 0;
											for(var n in selected_pools) {
												var curr = selected_pools[n].currency;
												var d = {name:n};

												var n = hashes[i];
												if(n < 0) n = 0;
												if(this.state.conversion == "TH/s")	n /= 1000;
												else if(this.state.conversion == "PH/s") n /= 1000000;
												n = Math.round(Number(n)*100)/100;
												d[curr] = n;
												data.push(d);
												i++;
											}

											for(var c in selected_currencies) {
												if(i < hashes.length) {
													var n = hashes[i];
													if(n < 0) n = 0;
													if(this.state.conversion == "TH/s")	n /= 1000;
													else if(this.state.conversion == "PH/s") n /= 1000000;
													n = Math.round(Number(n)*100)/100;

													var name = 'Solo '+c;
													var d = {name:name};
													d[c] = n;
													data.push(d);
													i++;
												}
											}

											console.log(data);
											this.props.updateResults("multicurr", data, this.colors,selected_currencies, selected_pools);
					    }).catch((error) => {
								console.error(error);
								alert("There was an error contacting the server. Please inform the web admin.");
							});
						}

						/** MULTI ALGO SOLVE **/
						else { // use multiple algorithm call and formatting
							/* format all data arguments for optimize */
							for(var n in selected_pools) {
								var curr = selected_pools[n].currency;
								var block_reward = this.state.currencies[curr].block_reward*this.state.currencies[curr].prices.USD;
								var block_time = this.state.currencies[curr].block_time;
								var total_hash = this.state.currencies[curr].total_hash;
								var algo = this.state.currencies[curr].algo;
								var max_algo = this.state.algos[algo].max;
								poolData += selected_pools[n].hash+','+selected_pools[n].fee+','+block_reward+','+block_time+','+total_hash+','+max_algo+',';
							}
							poolData = poolData.substring(0, poolData.length-1); // remove last ,

							console.log(poolData);
							fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/solve/multialgo', {
								method: 'POST',
								headers: {
								  'Accept': 'application/json',
								  'Content-Type': 'application/json',
								},
								body: JSON.stringify({
								  pools: poolData, //TODO FORMAT DATA FOR MULTIALGO
								  rho: risk, //risk aversion
								})
							})
							.then((response) => response.json())
					    .then((responseData) => {
								console.log(responseData);
								responseData = (responseData.solved).replace('[','').replace(']','');
								var hashes = responseData.split(' ');
								for(var i = hashes.length - 1; i >= 0; i--)
										if(hashes[i].length < 2)
											 hashes.splice(i, 1);

								var i = 0;
								for(var n in selected_pools) {
									var curr = selected_pools[n].currency;
									var d = {name:n};

									var n = hashes[i];
									if(n < 0) n = 0;
									if(this.state.conversion == "TH/s")	n /= 1000;
									else if(this.state.conversion == "PH/s") n /= 1000000;
									n = Math.round(Number(n)*100)/100;
									d[curr] = n;
									data.push(d);
									i++;
								}

								for(var c in selected_currencies) {
									if(i < hashes.length) {
										var n = hashes[i];
										if(n < 0) n = 0;
										if(this.state.conversion == "TH/s")	n /= 1000;
										else if(this.state.conversion == "PH/s") n /= 1000000;
										n = Math.round(Number(n)*100)/100;

										var name = 'Solo '+c;
										var d = {name:name};
										d[c] = n;
										data.push(d);
										i++;
									}
								}

								console.log(data);
								this.props.updateResults("multialgo", data, this.colors,selected_currencies, selected_pools);
					    }).catch((error) => {
								console.error(error);
								alert("There was an error contacting the server. Please inform the web admin.");
							});
						}
				}
			}
	}

	/* button asking to add custom pool */
	onAddPool = () => { this.setState({showCustomPoolOptions: true}) }

	/* button to add custom pool/confirm custom pool */
	onAddPoolConfirm = () => {
		var ps = this.state.pools;
		var curr = this.state.customPoolCurrency;
		var name = ReactDOM.findDOMNode(this.refs.Custom_Pool_Name).value.trim();
		var hash = ReactDOM.findDOMNode(this.refs.Custom_Pool_Hash).value.trim();
		var fee = ReactDOM.findDOMNode(this.refs.Custom_Pool_Fee).value.trim()/100;
		// do error checking all inputs for custom pool
		if(name == null || name.length < 3) alert("Custom pool name must be atleast 3 characters.");
		else if(hash == "" || isNaN(hash) || hash < 0 || hash > 99999999999) alert("Please enter a valid pool hash power.");
		else if(this.state.customPoolConversion.length < 2) alert("Please select a pool hash power unit.");
		else if(curr == "") alert("Please select a currency that the pool mines.");
		else if(fee == "" || isNaN(fee) || fee < 0 || fee > 1) alert("Please enter a valid pool fee.");

		else {
			name += " ("+curr+")";
			if(this.state.customPoolConversion == "TH/s")
				hash *= 1000;
			else if(this.state.customPoolConversion == "PH/s")
				hash *= 1000000;
			else if(this.state.customPoolConversion == "EH/s")
				hash *= 1000000000;
			this.setState({customPoolConversion: "GH/s"});
			ps[name] = {hash:hash, fee:fee, curr:curr, checked:true};
			this.setState({pools: ps});
			this.setState({showCustomPoolOptions: false});
		}
	}

	/* button to cancel adding a custom pool */
	onAddPoolCancel = () => {
		this.setState({showCustomPoolOptions: false});
		this.setState({customPoolConversion: "GH/s"});
	}

  /* button asking to add custom currency */
	onAddCurrency = () => { this.setState({showCustomCurrencyOptions: true}) }

	/* button to add custom pool/confirm custom pool */
	onAddCurrencyConfirm = () => {
		var cs = this.state.currencies;
		var name = ReactDOM.findDOMNode(this.refs.Custom_Currency_Name).value.trim();
		var symbol = ReactDOM.findDOMNode(this.refs.Custom_Currency_Symbol).value.trim();
		var algo = this.state.customCurrencyAlgo;
		var price = ReactDOM.findDOMNode(this.refs.Custom_Currency_Price).value.trim();
		var reward = ReactDOM.findDOMNode(this.refs.Custom_Currency_Reward).value.trim();


		if(name == null || name.length < 3) alert("Currency name must be atleast 3 characters.");
		else if(symbol == null || symbol.length < 3 || symbol.length > 5) alert("Currency symbol must be between 3 and 5 characters.");
		else if(algo == null || algo.length < 3) alert("Please enter a valid mining algorithm.");
		else if(price == "" || isNaN(price) || price < 0) alert("Please enter a valid currency price.");
		else if(reward == "" || isNaN(reward) || reward < 0) alert("Please enter a valid currency block reward.");

		else {
				cs[symbol] = {name:name, prices:{USD: price}, block_reward:reward, algo:algo, checked:true};
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
  		fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/api/currencies')
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
	   	fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/api/pools')
	    .then((response) => response.json())
	    .then((responseJson) => {
	    	var ps = [];
	    	for(var name in responseJson) {
	    		var n = name.replace("(dot)",".")
	    		ps[n] = responseJson[name];
	    		ps[n].checked = false;
	    	}
	    	this.setState({pools: ps});
	    }).catch((error) => {
				console.error(error);
				alert("There was an error contacting the server. Please inform the web admin.");
			});

			/* load algo data from api into state */
			fetch('http://ec2-34-229-73-9.compute-1.amazonaws.com:5000/api/algos')
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

				<ControlLabel>Hash Power ({this.state.customPoolConversion})</ControlLabel>
				<div className='inline'>
				<div className='narrow-form3'><FormControl type="text" ref="Custom_Pool_Hash" /></div>
				<div className='hash-select'>
				<FormControl componentClass="select" placeholder="GH/s"
				onChange = {e => this.setState({customPoolConversion: e.target.value})}>
					<option value="GH/s">GH/s</option>
					<option value="TH/s">TH/s</option>
					<option value="PH/s">PH/s</option>
					<option value="EH/s">EH/s</option>
				</FormControl>
				</div> </div> <br />
				<ControlLabel>Currency</ControlLabel>
				<div className='narrow-form2'>
				<FormControl componentClass="select" placeholder="BTC"
				onChange = {e => this.setState({customPoolCurrency: e.target.value})}>
						{currency_select}
				</FormControl>
				</div><br/>
				<Button onClick={() => this.onAddPoolConfirm()}> Add Pool</Button>
				<Button onClick={() => this.onAddPoolCancel()}> Cancel</Button>
			</FormGroup>
		var hidden_custom_pool_component = <FormGroup> <Button onClick={() => this.onAddPool()}> Add Pool</Button> </FormGroup>

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
					<div className='narrow-form2'> <div className='left-margined'> <ControlLabel>Reward</ControlLabel> </div> </div>
					</div>
					<div className='inline'>
					<div className='narrow-form3'> <FormControl type="text" ref="Custom_Currency_Price"/></div>
					<div className='narrow-form1'> <div className='left-margined'> <FormControl type="text" ref="Custom_Currency_Reward"/></div></div>
					</div><br/>

					<ControlLabel>Mining Algorithm</ControlLabel>
					<div className='narrow-form3'>
					<FormControl componentClass="select" placeholder="SHA-256" onChange = {e => this.setState({customCurrencyAlgo: e.target.value})}>
										{algo_select}
					</FormControl></div> <br/>
					<Button onClick={() => this.onAddCurrencyConfirm()}> Add Currency</Button>
					<Button onClick={() => this.onAddCurrencyCancel()}> Cancel</Button>
				</FormGroup>
		var hidden_custom_currency_component = <FormGroup> <Button onClick={() => this.onAddCurrency()}> Add Currency</Button> </FormGroup>

		var add_currency_component = hidden_custom_currency_component;
		if(this.state.showCustomCurrencyOptions)
			add_currency_component = shown_custom_currency_component;
  	var cnt1 = 0;
		var currency_boxes = [];
		for(var name in this.state.currencies) {
			currency_boxes.push(
			<> <Checkbox inline
			  		id = {name}
	          checked = {this.state.currencies[name].checked}
	          onChange = {this.onCurrencyBoxChange(name)}
	    > {name} </Checkbox></>);
      cnt1++;
     	if(cnt1 == 5) { currency_boxes.push(<><br/></>); cnt1 = 0; } // move to new line after 5 elements for formatting
		}

		var cnt2 = 0;
		var pool_boxes = [];
		for(var name in this.state.pools) {
			pool_boxes.push(
			<> <Checkbox inline
			  		id = {name}
	          checked = {this.state.pools[name].checked}
	          onChange = {this.onPoolBoxChange(name)}
	    > {name} </Checkbox></>);
	    cnt2++;
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

	        <FormGroup>
	          <ControlLabel>Your Hash Power ({this.state.conversion})</ControlLabel>
						<div className='inline'>
	          <div className='narrow-form3'> <FormControl inline type="text" ref="Hash"
	            value = {this.state.hash}
	            onChange = {e => this.setState({hash: e.target.value})}
	          /></div>
						<div className='hash-select'>
						<FormControl componentClass="select" placeholder="GH/s"
						onChange = {e => this.setState({conversion: e.target.value})}>
							<option value="GH/s">GH/s</option>
							<option value="TH/s">TH/s</option>
							<option value="PH/s">PH/s</option>
						</FormControl>
						</div> </div>
	          <HelpBlock>Your total mining hash power.</HelpBlock>
	        </FormGroup>

	        <FormGroup>
	          <ControlLabel>Risk Aversion</ControlLabel>
	          <div className='narrow-form2'> <FormControl type="text" ref="Risk"
	            value = {this.state.risk}
	            onChange = {e => this.setState({risk: e.target.value})}
	          /></div>
	          <HelpBlock>Suggested range 1-10.</HelpBlock>
	        </FormGroup>

	        <Button onClick={() => this.onSubmit()}> Submit </Button>
	       </form>
	    );
	}
}
