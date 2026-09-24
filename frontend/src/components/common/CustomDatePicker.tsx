import React from 'react';
import { AppDatePicker, AppDatePickerProps } from '../ui/AppDatePicker';

export type CustomDatePickerProps = AppDatePickerProps;

export const CustomDatePicker: React.FC<CustomDatePickerProps> = (props) => {
  return <AppDatePicker {...props} />;
};
