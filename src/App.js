import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import logo from './logo.svg';
import './App.css';

import Home from './components/Home';
import About from './components/About';
import Navbar from './components/CustomNavbar';

class App extends Component {
  render() {
    return (
      <Router>
        <div>
          <Navbar/>
          <Route exact path="/" component={Home} />
          <Route exact path="/about" component={About} />
        </div>
      </Router>
    );
  }
}

export default App;
