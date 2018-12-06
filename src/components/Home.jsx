import React, { Component } from 'react';
import MainForm from './MainForm'
import Results from './Results'
import './Home.css';

export default class Home extends Component {
  constructor(props) {
    super();
    this.state = {
      data: null, // graph data points
      keys: null, // keys for the graph if multicurrencied
      poolData: null, // pool data for each individual pool shown in chart
      currencyData: null, // currency data for each individual currency shown in chart
      showResults: false // wether or not to show results
    };
  }

  updateResults(type, data, keys, currencyData, poolData) {
    this.setState({type:type, data:data, keys:keys, currencyData:currencyData, poolData:poolData, showResults:true});
  }

  render() {
    return(
      <div className='inline'>
      <MainForm updateResults={this.updateResults.bind(this)}/>
      <Results type={this.state.type} show={this.state.showResults} data={this.state.data} keys={this.state.keys} poolData={this.state.poolData} currencyData={this.state.currencyData}/>
      </div>
    );
  }
}
