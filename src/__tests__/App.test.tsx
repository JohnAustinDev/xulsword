import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Xulsword from '../renderer/libxul/xulsword/xulsword.tsx';

describe('Main', () => {
  it('should render', () => {
    expect(render(<Xulsword />)).toBeTruthy();
  });
});
