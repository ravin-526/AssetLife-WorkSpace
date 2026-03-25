import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/models/email_sync_models.dart';
import 'package:assetlife_mobile/shared/services/email_scan_service.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';

class EmailScanScreen extends StatefulWidget {
  const EmailScanScreen({super.key});

  @override
  State<EmailScanScreen> createState() => _EmailScanScreenState();
}

class _EmailScanScreenState extends State<EmailScanScreen> {
  late final EmailScanService _service;
  final _daysController = TextEditingController(text: '10');
  final _maxResultsController = TextEditingController(text: '100');

  EmailScanSummary? _summary;
  bool _scanning = false;

  @override
  void initState() {
    super.initState();
    _service = EmailScanService(context.read<ApiClient>());
  }

  @override
  void dispose() {
    _daysController.dispose();
    _maxResultsController.dispose();
    super.dispose();
  }

  int _readInt(String raw, int fallback) {
    final value = int.tryParse(raw.trim());
    return value == null || value <= 0 ? fallback : value;
  }

  Future<void> _scanEmails() async {
    setState(() {
      _scanning = true;
    });

    try {
      final summary = await _service.scanEmails(
        days: _readInt(_daysController.text, 10),
        maxResults: _readInt(_maxResultsController.text, 100),
      );
      if (!mounted) return;
      setState(() {
        _summary = summary;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Scan complete. Suggestions created: ${summary.createdSuggestions}',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _scanning = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Email Scan'),
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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Scan Gmail for purchase emails',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _daysController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Last X days',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _maxResultsController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Max results',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: _scanning ? null : _scanEmails,
                    icon: const Icon(Icons.mail_outline),
                    label: Text(_scanning ? 'Scanning...' : 'Scan Emails'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (_summary != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Scan Summary',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    Text('Status: ${_summary!.syncStatus}'),
                    Text(
                      'Scanned Emails: ${_summary!.emailsScanned > 0 ? _summary!.emailsScanned : _summary!.scanned}',
                    ),
                    Text(
                      'Purchase Emails Detected: ${_summary!.purchaseEmailsDetected}',
                    ),
                    Text(
                      'Attachments Detected: ${_summary!.attachmentsDetected}',
                    ),
                    Text(
                      'Attachments Downloaded: ${_summary!.attachmentsDownloaded}',
                    ),
                    Text(
                      'Attachments Processed: ${_summary!.attachmentsProcessed}',
                    ),
                    Text(
                      'Suggestions Created: ${_summary!.createdSuggestions}',
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pushNamed(
                          context,
                          AppConstants.suggestionsRoute,
                        );
                      },
                      icon: const Icon(Icons.visibility_outlined),
                      label: const Text('View Suggestions'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
