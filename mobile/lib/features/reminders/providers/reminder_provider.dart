import 'package:flutter/material.dart';
import '../../../shared/models/asset.dart';
import '../../../shared/services/reminder_service.dart';

class ReminderProvider extends ChangeNotifier {
  final ReminderService _reminderService;
  
  List<Reminder> _reminders = [];
  bool _isLoading = false;
  String? _error;
  
  ReminderProvider(this._reminderService);
  
  // Getters
  List<Reminder> get reminders => _reminders;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Get Reminders
  Future<void> fetchReminders() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      _reminders = await _reminderService.getReminders();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Create Reminder
  Future<Reminder> createReminder(Map<String, dynamic> data) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final reminder = await _reminderService.createReminder(data);
      _reminders.add(reminder);
      return reminder;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Update Reminder
  Future<Reminder> updateReminder(
    String reminderId,
    Map<String, dynamic> data,
  ) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final reminder = await _reminderService.updateReminder(reminderId, data);
      final index = _reminders.indexWhere((r) => r.id == reminderId);
      if (index != -1) {
        _reminders[index] = reminder;
      }
      return reminder;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Delete Reminder
  Future<void> deleteReminder(String reminderId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      await _reminderService.deleteReminder(reminderId);
      _reminders.removeWhere((r) => r.id == reminderId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Mark as completed
  Future<void> markAsCompleted(String reminderId) async {
    try {
      await _reminderService.markAsCompleted(reminderId);
      final index = _reminders.indexWhere((r) => r.id == reminderId);
      if (index != -1) {
        _reminders[index] = Reminder.fromJson({
          ..._reminders[index].toJson(),
          'status': 'completed',
        });
      }
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }
  
  // Get active reminders
  List<Reminder> getActiveReminders() {
    return _reminders.where((r) => r.status == 'active').toList();
  }
  
  // Get reminders for asset
  List<Reminder> getRemindersForAsset(String assetId) {
    return _reminders
        .where((r) => r.assetId == assetId && r.status == 'active')
        .toList();
  }
  
  // Get total active reminders count
  int getActiveRemindersCount() {
    return _reminders.where((r) => r.status == 'active').length;
  }
}

// Extension to convert Reminder to JSON
extension ReminderJson on Reminder {
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      '_id': id,
      'title': title,
      'reminder_date': reminderDate,
      'reminder_type': reminderType,
      'type': type,
      'status': status,
      'asset_id': assetId,
      'asset_name': assetName,
      'notes': notes,
    };
  }
}
