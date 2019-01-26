import React, { Component } from 'react';
import { Navbar, Nav, NavItem } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import "./CustomNavbar.css";

export default class CustomNavBar extends Component {
	render() {
		return (
			<Navbar>
				<Nav>
					<NavItem eventKey={1} href="/" to="/"> Home </NavItem>
					<NavItem eventKey={2} href="/about" to="/about"> About </NavItem>
				</Nav>
			</Navbar>
		)
	}
}
