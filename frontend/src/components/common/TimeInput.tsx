import React from 'react';
import { AppTimePicker, AppTimePickerProps } from '../ui/AppTimePicker';

export type TimeInputProps = AppTimePickerProps;

export const TimeInput: React.FC<TimeInputProps> = (props) => {
  return <AppTimePicker {...props} />;
};
