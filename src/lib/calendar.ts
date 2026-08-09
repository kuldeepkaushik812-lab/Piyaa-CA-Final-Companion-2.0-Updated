import { getAccessToken } from './auth';

export const syncEventToGoogleCalendar = async (
  title: string,
  startTime: Date,
  endTime: Date
) => {
  const token = await getAccessToken();
  if (!token) {
    console.log("No Google token found, cannot sync to calendar.");
    return 'Unknown error';
  }
  
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Kolkata'
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Kolkata'
        },
        description: 'Autosynced from Piyaa CA Final Companion'
      })
    });
    
    if (response.ok) {
      console.log('Successfully synced event to Google Calendar');
      return true;
    } else {
      const errorText = await response.text();
      console.error('Failed to sync event', errorText);
      return errorText;
    }
  } catch (error) {
    console.error('Error syncing to calendar:', error);
    return 'Unknown error';
  }
};
