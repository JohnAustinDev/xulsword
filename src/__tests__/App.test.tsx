import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Xulsword from '../renderer/xulsword/xulsword';

describe('Main', () => {
  it('should render', () => {
    expect(render(<Xulsword />)).toBeTruthy();
  });
});
