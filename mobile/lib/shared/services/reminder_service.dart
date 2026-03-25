import '../../core/api/api_client.dart';
import '../models/asset.dart';

class ReminderService {
  final ApiClient apiClient;
  
  ReminderService(this.apiClient);
  
  Future<List<Reminder>> getReminders() async {
    try {
      final response = await apiClient.get('/api/reminders');
      if (response is List) {
        return response.map((json) => Reminder.fromJson(json)).toList();
      } else if (response is Map && response['data'] is List) {
        return (response['data'] as List)
            .map((json) => Reminder.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
  
  Future<Reminder> createReminder(Map<String, dynamic> data) async {
    try {
      final response = await apiClient.post('/api/reminders', data: data);
      return Reminder.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
  
  Future<Reminder> updateReminder(
    String reminderId,
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await apiClient.put(
        '/api/reminders/$reminderId',
        data: data,
      );
      return Reminder.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
  
  Future<void> deleteReminder(String reminderId) async {
    try {
      await apiClient.delete('/api/reminders/$reminderId');
    } catch (e) {
      rethrow;
    }
  }
  
  Future<void> markAsCompleted(String reminderId) async {
    try {
      await updateReminder(reminderId, {'status': 'completed'});
    } catch (e) {
      rethrow;
    }
  }
}
