import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/features/suggestions/screens/asset_suggestions_screen.dart';
import 'package:assetlife_mobile/features/suggestions/screens/suggestion_attachment_preview_screen.dart';
import 'package:assetlife_mobile/shared/models/email_sync_models.dart';
import 'package:assetlife_mobile/shared/services/suggestion_service.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';

class SuggestionDetailScreen extends StatefulWidget {
  final SuggestionDetailArgs args;

  const SuggestionDetailScreen({super.key, required this.args});

  @override
  State<SuggestionDetailScreen> createState() => _SuggestionDetailScreenState();
}

class _SuggestionDetailScreenState extends State<SuggestionDetailScreen> {
  late final SuggestionService _service;
  SuggestionEmailDetails? _emailDetails;
  bool _loading = true;
  bool _busy = false;

  AssetSuggestion get _suggestion => widget.args.suggestion;

  @override
  void initState() {
    super.initState();
    _service = SuggestionService(context.read<ApiClient>());
    _loadEmailDetails();
  }

  String _formatDate(String? value) {
    if (value == null || value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return DateFormat('dd MMM yyyy').format(parsed);
  }

  Future<void> _loadEmailDetails() async {
    try {
      final details = await _service.getSuggestionEmailDetails(_suggestion.id);
      if (!mounted) return;
      setState(() {
        _emailDetails = details;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
    });

    try {
      await _service.confirmSuggestion(_suggestion.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Asset added successfully')));
      Navigator.pop(context, {'action': 'confirmed', 'id': _suggestion.id});
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _reject() async {
    setState(() {
      _busy = true;
    });

    try {
      await _service.rejectSuggestion(_suggestion.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Suggestion rejected')));
      Navigator.pop(context, {'action': 'rejected', 'id': _suggestion.id});
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Suggestion Details'),
        actions: [
          Consumer<ThemeProvider>(
            builder: (context, themeProvider, _) => IconButton(
              icon: Icon(
                themeProvider.isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
              ),
              onPressed: themeProvider.toggle,
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _suggestion.productName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text('Vendor: ${_suggestion.vendor ?? '-'}'),
                        Text(
                          'Price: ${_suggestion.price?.toStringAsFixed(2) ?? '-'}',
                        ),
                        Text(
                          'Date: ${_formatDate(_suggestion.purchaseDate ?? _suggestion.emailDate)}',
                        ),
                        Text(
                          'Status: ${_suggestion.alreadyAdded ? 'Already Added' : _suggestion.status}',
                        ),
                        const SizedBox(height: 8),
                        if ((_suggestion.attachmentFilename ?? '').isNotEmpty)
                          OutlinedButton.icon(
                            onPressed: () {
                              Navigator.pushNamed(
                                context,
                                AppConstants.suggestionAttachmentPreviewRoute,
                                arguments: SuggestionAttachmentPreviewArgs(
                                  suggestionId: _suggestion.id,
                                  attachmentName:
                                      _suggestion.attachmentFilename,
                                  attachmentMimeType:
                                      _suggestion.attachmentMimeType,
                                ),
                              );
                            },
                            icon: const Icon(Icons.attach_file),
                            label: const Text('Preview Attachment'),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Email Details',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Sender: ${_emailDetails?.sender ?? _suggestion.sender ?? '-'}',
                        ),
                        Text(
                          'Subject: ${_emailDetails?.subject ?? _suggestion.subject ?? '-'}',
                        ),
                        Text(
                          'Date: ${_formatDate(_emailDetails?.receivedDate ?? _suggestion.emailDate)}',
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _emailDetails?.emailBody?.trim().isNotEmpty == true
                              ? _emailDetails!.emailBody!
                              : 'No email body available',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    ElevatedButton(
                      onPressed: (_busy || _suggestion.alreadyAdded)
                          ? null
                          : _confirm,
                      child: Text(_busy ? 'Adding...' : 'Add Asset'),
                    ),
                    TextButton(
                      onPressed: (_busy || _suggestion.alreadyAdded)
                          ? null
                          : _reject,
                      child: const Text('Reject'),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
