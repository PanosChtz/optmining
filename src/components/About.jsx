import React, { Component, NavItem, Link } from 'react';
import './About.css';

export default class Home extends Component {
  render() {
    return(
      <div>
      <h2>About</h2>
      <p>Smart Miner is a web application that allows users to find the most optimized distribution of their hash power. The application uses live
      currency, pool, and user configurated data to compute the most optimial distribution.</p>
      <h4><a href="https://arxiv.org/abs/1905.04624v2">Paper</a></h4>
      <br/>
      <h2>Team</h2>
      <h4><a href="https://cs.gmu.edu/~pchatzig/">Panos Chatzigiannis</a></h4>
      <h4><a href="http://www.baldimtsi.com/">Foteini Baldimtsi</a></h4>
      <h4><a href="https://sites.google.com/site/jiasunlihome/">Jiasun Li</a></h4>
      </div>
    );
  }
}
