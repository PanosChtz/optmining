import React, { Component } from 'react';
import { Panel, ListGroup, ListGroupItem } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from  'recharts';
import './Results.css';

export default class Home extends Component {

    showAlert(arg) {
      alert(arg);
    }

    render() {
      var results;
      var currencyData = [];
      for (var n in this.props.currencyData)
        currencyData.push(<ListGroupItem value={JSON.stringify(this.props.currencyData[n])} onClick={e => this.showAlert(e.target.value)}>{n}</ListGroupItem>);
      var poolData = [];
      for (var n in this.props.poolData)
        poolData.push(<ListGroupItem value={JSON.stringify(this.props.poolData[n])} onClick={e => this.showAlert(e.target.value)}>{n}</ListGroupItem>);

      var detailed_data =
                  <>
                  <div className='inline'> <div className='narrow'>
                  <Panel>
                  <Panel.Heading>Currency Data</Panel.Heading>
                  <ListGroup>
                  {currencyData}
                  </ListGroup>
                  </Panel>
                  </div>
                  <div className='narrow'>
                  <Panel>
                  <Panel.Heading>Pool Data</Panel.Heading>
                  <ListGroup>
                  {poolData}
                  </ListGroup>
                  </Panel>
                  </div></div>
                  </>;

      if(this.props.show) {
        var bars = [];
        if(this.props.type == "single") {
          for(var n in this.props.keys)
            bars.push(<Bar dataKey={n} fill={this.props.keys[n]}/>)
          var width = (poolData.length*150) + 500;
          return(
            <div>
            <BarChart width={width} height={400} data={this.props.data} margin={{top: 5, right: 0, left: 50, bottom: 50}}>
                    <CartesianGrid strokeDasharray="10 10"/>
                    <XAxis dataKey="name"/>
                    <YAxis/>
                    <Tooltip/>
                    <Legend/>
                    {bars}
            </BarChart>
            {detailed_data}
            </div>
          );
        }

        else if(this.props.type == "multicurr" || this.props.type == "multialgo") {
          for(var n in this.props.keys)
            bars.push(<Bar dataKey={n} stackId="a" fill={this.props.keys[n]} />)
          var width = (poolData.length*150) + 500;
          console.log(width);
          return (
            <div>
          	<BarChart width={width} height={400} data={this.props.data} margin={{top: 5, right: 0, left: 50, bottom: 50}}>
             <CartesianGrid strokeDasharray="10 10"/>
             <XAxis dataKey="name"/>
             <YAxis/>
             <Tooltip/>
             <Legend />
             {bars}
            </BarChart>
            <div className='left-push'>{detailed_data}</div>
            </div>
          );
        }
      }

      else
        return(<></>);
  }
}
