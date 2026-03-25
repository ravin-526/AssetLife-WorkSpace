class Asset {
  final String id;
  final String name;
  final String category;
  final String subcategory;
  final String? brand;
  final String? vendor;
  final String status;
  final bool isInactive;
  final String? purchaseDate;
  final String? price;
  final Map<String, dynamic>? lifecycleInfo;
  
  Asset({
    required this.id,
    required this.name,
    required this.category,
    required this.subcategory,
    this.brand,
    this.vendor,
    required this.status,
    this.isInactive = false,
    this.purchaseDate,
    this.price,
    this.lifecycleInfo,
  });
  
  factory Asset.fromJson(Map<String, dynamic> json) {
    return Asset(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      category: json['category'] ?? '',
      subcategory: json['subcategory'] ?? '',
      brand: json['brand'],
      vendor: json['vendor'],
      status: json['status'] ?? 'Active',
      isInactive: json['is_inactive'] ?? false,
      purchaseDate: json['purchase_date'],
      price: json['price']?.toString(),
      lifecycleInfo: json['lifecycle_info'] ?? {
        'warranty': {},
        'insurance': {},
        'service': {},
      },
    );
  }
}

class Reminder {
  final String id;
  final String title;
  final String reminderDate;
  final String reminderType; // 'warranty', 'service', 'custom'
  final String type; // 'asset' or 'custom'
  final String status; // 'active', 'completed', 'snoozed'
  final String? assetId;
  final String? assetName;
  final String? notes;
  
  Reminder({
    required this.id,
    required this.title,
    required this.reminderDate,
    required this.reminderType,
    required this.type,
    required this.status,
    this.assetId,
    this.assetName,
    this.notes,
  });
  
  factory Reminder.fromJson(Map<String, dynamic> json) {
    return Reminder(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title'] ?? '',
      reminderDate: json['reminder_date'] ?? '',
      reminderType: json['reminder_type'] ?? 'custom',
      type: json['type'] ?? 'custom',
      status: json['status'] ?? 'active',
      assetId: json['asset_id'],
      assetName: json['asset_name'],
      notes: json['notes'],
    );
  }
}
