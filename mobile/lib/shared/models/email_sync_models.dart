class GmailConnectionStatus {
  final bool connected;
  final String mailboxType;
  final String? emailAddress;
  final DateTime? lastSyncAt;

  const GmailConnectionStatus({
    required this.connected,
    this.mailboxType = 'gmail',
    this.emailAddress,
    this.lastSyncAt,
  });

  factory GmailConnectionStatus.fromJson(Map<String, dynamic> json) {
    return GmailConnectionStatus(
      connected: json['connected'] == true,
      mailboxType: (json['mailbox_type'] ?? 'gmail').toString(),
      emailAddress: json['email_address']?.toString(),
      lastSyncAt: DateTime.tryParse((json['last_sync_at'] ?? '').toString()),
    );
  }
}

class GmailConnectResponse {
  final String authUrl;
  final String state;

  const GmailConnectResponse({required this.authUrl, required this.state});

  factory GmailConnectResponse.fromJson(Map<String, dynamic> json) {
    return GmailConnectResponse(
      authUrl: (json['auth_url'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
    );
  }
}

class EmailScanSummary {
  final String syncStatus;
  final int scanned;
  final int emailsScanned;
  final int purchaseEmailsDetected;
  final int attachmentsDetected;
  final int attachmentsDownloaded;
  final int attachmentsProcessed;
  final int createdSuggestions;

  const EmailScanSummary({
    required this.syncStatus,
    required this.scanned,
    required this.emailsScanned,
    required this.purchaseEmailsDetected,
    required this.attachmentsDetected,
    required this.attachmentsDownloaded,
    required this.attachmentsProcessed,
    required this.createdSuggestions,
  });

  factory EmailScanSummary.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic value) => int.tryParse(value?.toString() ?? '') ?? 0;

    return EmailScanSummary(
      syncStatus: (json['sync_status'] ?? 'unknown').toString(),
      scanned: toInt(json['scanned']),
      emailsScanned: toInt(json['emails_scanned']),
      purchaseEmailsDetected: toInt(json['purchase_emails_detected']),
      attachmentsDetected: toInt(json['attachments_detected']),
      attachmentsDownloaded: toInt(json['attachments_downloaded']),
      attachmentsProcessed: toInt(json['attachments_processed']),
      createdSuggestions: toInt(json['created_suggestions']),
    );
  }
}

class AssetSuggestion {
  final String id;
  final String productName;
  final String? vendor;
  final double? price;
  final String? purchaseDate;
  final String status;
  final String? sender;
  final String? subject;
  final String? emailDate;
  final String? attachmentFilename;
  final String? attachmentMimeType;
  final String? invoiceAttachmentPath;
  final bool alreadyAdded;

  const AssetSuggestion({
    required this.id,
    required this.productName,
    this.vendor,
    this.price,
    this.purchaseDate,
    required this.status,
    this.sender,
    this.subject,
    this.emailDate,
    this.attachmentFilename,
    this.attachmentMimeType,
    this.invoiceAttachmentPath,
    required this.alreadyAdded,
  });

  factory AssetSuggestion.fromJson(Map<String, dynamic> json) {
    return AssetSuggestion(
      id: (json['id'] ?? '').toString(),
      productName: (json['product_name'] ?? '').toString(),
      vendor: json['vendor']?.toString(),
      price: double.tryParse((json['price'] ?? '').toString()),
      purchaseDate: json['purchase_date']?.toString(),
      status: (json['status'] ?? 'pending').toString(),
      sender: json['sender']?.toString(),
      subject: json['subject']?.toString(),
      emailDate: json['email_date']?.toString(),
      attachmentFilename: json['attachment_filename']?.toString(),
      attachmentMimeType: json['attachment_mime_type']?.toString(),
      invoiceAttachmentPath: json['invoice_attachment_path']?.toString(),
      alreadyAdded: json['already_added'] == true,
    );
  }
}

class SuggestionEmailAttachment {
  final String fileName;
  final String? mimeType;
  final int? size;

  const SuggestionEmailAttachment({
    required this.fileName,
    this.mimeType,
    this.size,
  });

  factory SuggestionEmailAttachment.fromJson(Map<String, dynamic> json) {
    return SuggestionEmailAttachment(
      fileName: (json['file_name'] ?? '').toString(),
      mimeType: json['mime_type']?.toString(),
      size: int.tryParse((json['size'] ?? '').toString()),
    );
  }
}

class SuggestionEmailDetails {
  final String? subject;
  final String? sender;
  final String? receivedDate;
  final String? emailBody;
  final String? emailBodyHtml;
  final List<SuggestionEmailAttachment> attachments;

  const SuggestionEmailDetails({
    this.subject,
    this.sender,
    this.receivedDate,
    this.emailBody,
    this.emailBodyHtml,
    required this.attachments,
  });

  factory SuggestionEmailDetails.fromJson(Map<String, dynamic> json) {
    final rawAttachments = json['attachments'];
    final attachments = rawAttachments is List
        ? rawAttachments
              .whereType<Map>()
              .map(
                (item) => SuggestionEmailAttachment.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList()
        : <SuggestionEmailAttachment>[];

    return SuggestionEmailDetails(
      subject: json['subject']?.toString(),
      sender: json['sender']?.toString(),
      receivedDate: json['received_date']?.toString(),
      emailBody: json['email_body']?.toString(),
      emailBodyHtml: json['email_body_html']?.toString(),
      attachments: attachments,
    );
  }
}
