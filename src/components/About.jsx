import React, { Component, NavItem, Link } from 'react';
import './About.css';

export default class Home extends Component {
  render() {
    return(
      <div>
      <h2>About</h2>
      <p>Smart Miner is a web application that allows users to find the most optimized distribution of their hash power. The application uses live
      currency, pool, and user configurated data to compute the most optimial distribution.</p>
      <h4><a href="https://github.com/PanosChtz/Mining-pools/blob/master/Diversification%20across%20pools.pdf">White Paper</a></h4>
      <br/>
      <h2>Team</h2>
      <h4>Foteini Baldimtsi (<a href="https://cs.gmu.edu/directory/detail/65/">GMU</a>)</h4>
      <h4>Panos Chatzigiannis (<a href="https://mason.gmu.edu/~pchatzig/">GMU</a>)</h4>
      <h4>Jiasun Li (<a href="http://business.gmu.edu/facultyandresearch/faculty/finance/profile/48/112/">GMU</a>)</h4>
      </div>
    );
  }
}
