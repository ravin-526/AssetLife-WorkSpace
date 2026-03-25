import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/shared/services/suggestion_service.dart';

class SuggestionAttachmentPreviewArgs {
  final String suggestionId;
  final String? attachmentName;
  final String? attachmentMimeType;

  const SuggestionAttachmentPreviewArgs({
    required this.suggestionId,
    this.attachmentName,
    this.attachmentMimeType,
  });
}

class SuggestionAttachmentPreviewScreen extends StatefulWidget {
  final SuggestionAttachmentPreviewArgs args;

  const SuggestionAttachmentPreviewScreen({super.key, required this.args});

  @override
  State<SuggestionAttachmentPreviewScreen> createState() =>
      _SuggestionAttachmentPreviewScreenState();
}

class _SuggestionAttachmentPreviewScreenState
    extends State<SuggestionAttachmentPreviewScreen> {
  late final SuggestionService _service;

  Uint8List? _bytes;
  bool _loading = true;
  String? _error;

  bool get _isPdf {
    final mime = (widget.args.attachmentMimeType ?? '').toLowerCase();
    final name = (widget.args.attachmentName ?? '').toLowerCase();
    return mime.contains('pdf') || name.endsWith('.pdf');
  }

  bool get _isImage {
    final mime = (widget.args.attachmentMimeType ?? '').toLowerCase();
    final name = (widget.args.attachmentName ?? '').toLowerCase();
    if (mime.startsWith('image/')) {
      return true;
    }
    return name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.gif') ||
        name.endsWith('.webp');
  }

  @override
  void initState() {
    super.initState();
    _service = SuggestionService(context.read<ApiClient>());
    _loadAttachment();
  }

  Future<void> _loadAttachment() async {
    try {
      final bytes = await _service.fetchSuggestionAttachmentBytes(
        widget.args.suggestionId,
      );
      if (!mounted) return;
      setState(() {
        _bytes = Uint8List.fromList(bytes);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.args.attachmentName ?? 'Attachment Preview'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : (_bytes == null || _bytes!.isEmpty)
          ? const Center(child: Text('Attachment is empty'))
          : _isPdf
          ? SfPdfViewer.memory(_bytes!)
          : _isImage
          ? Container(
              color: Colors.black,
              child: Center(
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: Image.memory(_bytes!, fit: BoxFit.contain),
                ),
              ),
            )
          : Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.insert_drive_file_outlined, size: 40),
                    const SizedBox(height: 10),
                    Text(
                      'Preview is available only for PDF/images.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
