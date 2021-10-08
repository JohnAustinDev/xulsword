import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Main from '../renderer/main/App';

describe('Main', () => {
  it('should render', () => {
    expect(render(<Main />)).toBeTruthy();
  });
});

/*
describe('About', () => {
  it('should render', () => {
    expect(render(<About />)).toBeTruthy();
  });
});
*/
